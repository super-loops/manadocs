import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { SqlBool, sql } from 'kysely';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import { PagePermissionRepo } from '@manadocs/db/repos/page/page-permission.repo';
import {
  computeDiffStats,
  EMPTY_DOC,
  isSameDoc,
} from '../utils/diff-stats.util';

export interface WorkingChangeEntry {
  pageId: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  added: number;
  deleted: number;
}

/** 통계 계산은 문서 diff 라 비싸다 — 내용이 그대로면 다시 계산하지 않는다. */
type CacheEntry = { key: string; added: number; deleted: number };

const CACHE_LIMIT = 500;

/**
 * "수정중" — 아직 확정하지 않은 수정이 남아 있는 페이지.
 *
 * 판정 근거는 `pages.content` 다. 협업 저장(persistence.extension)이 Primary
 * 작업문서를 저장할 때 이 컬럼을 함께 갱신하므로, 사용자가 페이지를 떠나 에디터가
 * 사라진 뒤에도 서버가 최신 미확정 내용을 들고 있다.
 *
 * v1 은 Primary 작업문서만 본다. 페이지를 떠나면 "활성 작업문서"(클라 atom)라는
 * 개념 자체가 남지 않고, 전 작업문서를 훑으면 페이지×작업문서 비교가 된다.
 */
@Injectable()
export class WorkingChangesService {
  private readonly statsCache = new Map<string, CacheEntry>();

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pagePermissionRepo: PagePermissionRepo,
  ) {}

  async listForSpace(
    spaceId: string,
    userId: string,
  ): Promise<WorkingChangeEntry[]> {
    // 1) 후보 추리기 — content 비교는 Postgres 안에서 끝내고 본문은 옮기지 않는다.
    //    jsonb 는 키 순서를 정규화하므로, 커밋이 쓰는 isDeepStrictEqual 과 판정이
    //    일치한다(확정 커밋은 작업문서 content 를 그대로 버전에 복사한다).
    const candidates = await this.db
      .selectFrom('pages as p')
      .leftJoin('pageVersions as v', 'v.id', 'p.primaryVersionId')
      .select([
        'p.id as id',
        'p.slugId as slugid',
        'p.title as title',
        'p.icon as icon',
        'p.updatedAt as updatedat',
        'p.primaryVersionId as versionid',
      ])
      .where('p.spaceId', '=', spaceId)
      .where('p.deletedAt', 'is', null)
      .where((eb) =>
        eb.or([
          // 아직 한 번도 확정하지 않은 페이지 — 전체가 미확정 수정이다
          eb('p.primaryVersionId', 'is', null),
          // 괄호 필수 — `=` 가 `is distinct from` 보다 먼저 묶여서
          // `v.content is distinct from (p.content = true)` 로 파싱된다.
          sql<SqlBool>`(v.content is distinct from p.content)`,
        ]),
      )
      .orderBy('p.updatedAt', 'desc')
      .execute();

    if (candidates.length === 0) return [];

    // 2) 접근 권한 필터 — 제한 페이지가 없는 스페이스면 그대로 통과한다
    const accessible = new Set(
      await this.pagePermissionRepo.filterAccessiblePageIds({
        pageIds: candidates.map((c) => c.id),
        userId,
        spaceId,
      }),
    );
    const visible = candidates.filter((c) => accessible.has(c.id));
    if (visible.length === 0) return [];

    // 3) 통계 — 캐시에 없는 페이지만 본문을 읽어 계산한다
    const misses = visible.filter((c) => !this.statsCache.has(cacheKey(c)));
    const contents = await this.loadContents(misses.map((c) => c.id));

    const entries: WorkingChangeEntry[] = [];
    for (const candidate of visible) {
      const key = cacheKey(candidate);
      let stats = this.statsCache.get(key);
      if (!stats) {
        const row = contents.get(candidate.id);
        // SQL 의 `is distinct from` 은 후보를 넓게 뽑는 1차 필터일 뿐이다.
        // 실질 동일 판정은 결합 패널 뱃지와 **같은 함수**로 한다 — 그래야
        // 갓 만든 빈 페이지(빈 문단 하나)나 Yjs 왕복 차이가 한쪽 화면에서만
        // "수정중"으로 보이는 일이 없다.
        const computed = isSameDoc(row?.versionContent, row?.content)
          ? { added: 0, deleted: 0 }
          : computeDiffStats(
              row?.versionContent ?? EMPTY_DOC,
              row?.content ?? EMPTY_DOC,
            );
        stats = { key, ...computed };
        this.remember(key, stats);
      }
      // 통계가 0 이면 목록에 올릴 실질 변경이 없다
      if (stats.added === 0 && stats.deleted === 0) continue;
      entries.push({
        pageId: candidate.id,
        slugId: candidate.slugid,
        title: candidate.title ?? null,
        icon: candidate.icon ?? null,
        added: stats.added,
        deleted: stats.deleted,
      });
    }

    return entries;
  }

  private async loadContents(pageIds: string[]) {
    const map = new Map<string, { content: any; versionContent: any }>();
    if (pageIds.length === 0) return map;

    const rows = await this.db
      .selectFrom('pages as p')
      .leftJoin('pageVersions as v', 'v.id', 'p.primaryVersionId')
      .select([
        'p.id as id',
        'p.content as content',
        'v.content as versioncontent',
      ])
      .where('p.id', 'in', pageIds)
      .execute();

    for (const row of rows) {
      map.set(row.id, {
        content: row.content,
        versionContent: row.versioncontent,
      });
    }
    return map;
  }

  private remember(key: string, entry: CacheEntry) {
    // 단순 FIFO — 스페이스 하나의 수정중 페이지 수는 작고, 오래된 항목은
    // 어차피 updatedAt 이 바뀌어 키가 무효해진다.
    if (this.statsCache.size >= CACHE_LIMIT) {
      const oldest = this.statsCache.keys().next();
      if (!oldest.done) this.statsCache.delete(oldest.value);
    }
    this.statsCache.set(key, entry);
  }
}

/**
 * 캐시 키 — 비교 대상 두 쪽이 그대로면 통계도 그대로다.
 * `pages.updatedAt` 은 content 를 쓰는 모든 경로(updatePage)가 갱신하므로
 * 본문 변경 신호로 충분하다.
 */
function cacheKey(row: {
  id: string;
  updatedat: Date;
  versionid: string | null;
}): string {
  return `${row.id}:${new Date(row.updatedat).getTime()}:${row.versionid ?? "none"}`;
}
