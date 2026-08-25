import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import { AttachmentRepo } from '@manadocs/db/repos/attachment/attachment.repo';

/** 트리 배지 한 번에 내려주는 상한 — 초대형 스페이스에서 응답이 커지는 걸 막는다 */
const PAGE_BADGE_LIMIT = 2000;

export interface SpaceOverviewActor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  lastActiveAt: Date;
  kind: 'edit' | 'commit' | 'review';
}

/**
 * 개요 대시보드 집계. 새 트래킹 테이블 없이 기존 테이블(pages / page_versions /
 * reviews / attachments)에서 읽어 만든다.
 */
@Injectable()
export class SpaceOverviewService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly attachmentRepo: AttachmentRepo,
  ) {}

  /**
   * 사이드바 트리 hover 툴팁용 경량 배지 — 페이지별 Primary 버전 번호와
   * Primary 작업문서 id·base 버전만. 트리 API(/pages/sidebar-pages)는 로딩
   * 핫패스라 필드를 늘리지 않고, 스페이스 단위로 한 번에 받아 캐싱한다.
   * 분기코드는 클라이언트가 workingDocId 에서 유도한다(@/lib/branch-code).
   */
  async getPageVersionBadges(spaceId: string) {
    const rows = await this.db
      .selectFrom('pages')
      .leftJoin(
        'pageVersions as primaryVersion',
        'primaryVersion.id',
        'pages.primaryVersionId',
      )
      .leftJoin(
        'pageWorkingDocs as workingDoc',
        'workingDoc.id',
        'pages.primaryWorkingDocId',
      )
      .leftJoin(
        'pageVersions as baseVersion',
        'baseVersion.id',
        'workingDoc.baseVersionId',
      )
      .select([
        'pages.id as pageId',
        'primaryVersion.version as version',
        'pages.primaryWorkingDocId as workingDocId',
        'baseVersion.version as baseVersion',
      ])
      .where('pages.spaceId', '=', spaceId)
      .where('pages.deletedAt', 'is', null)
      .where((eb) =>
        eb.or([
          eb('pages.primaryVersionId', 'is not', null),
          eb('pages.primaryWorkingDocId', 'is not', null),
        ]),
      )
      .limit(PAGE_BADGE_LIMIT)
      .execute();

    return { items: rows, limit: PAGE_BADGE_LIMIT };
  }

  async getOverview(spaceId: string) {
    const recentSince = new Date();
    recentSince.setDate(recentSince.getDate() - 7);

    const [pages, assets, recentAssets, actors, activityCounts] =
      await Promise.all([
        this.getPageStats(spaceId, recentSince),
        this.attachmentRepo.getSpaceAssetStats(spaceId, recentSince),
        this.attachmentRepo.getRecentSpaceAssets(spaceId, 5),
        this.getRecentActors(spaceId, 5),
        this.getActivityCounts(spaceId, recentSince),
      ]);

    return {
      pages,
      assets,
      recentAssets,
      actors,
      activity: activityCounts,
      recentSince,
    };
  }

  private async getPageStats(spaceId: string, recentSince: Date) {
    const live = this.db
      .selectFrom('pages')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('spaceId', '=', spaceId)
      .where('deletedAt', 'is', null);

    const [total, committed, recent, trashed] = await Promise.all([
      live.executeTakeFirst(),
      live.where('primaryVersionId', 'is not', null).executeTakeFirst(),
      live.where('updatedAt', '>=', recentSince).executeTakeFirst(),
      this.db
        .selectFrom('pages')
        .select((eb) => eb.fn.countAll<string>().as('total'))
        .where('spaceId', '=', spaceId)
        .where('deletedAt', 'is not', null)
        .executeTakeFirst(),
    ]);

    const totalCount = Number(total?.total ?? 0);
    const committedCount = Number(committed?.total ?? 0);

    return {
      total: totalCount,
      committed: committedCount,
      uncommitted: totalCount - committedCount,
      recentlyUpdated: Number(recent?.total ?? 0),
      trashed: Number(trashed?.total ?? 0),
    };
  }

  /** 최근 활동한 사람 — 편집/확정/리뷰 중 가장 최근 시각 기준 상위 N명 */
  private async getRecentActors(
    spaceId: string,
    limit: number,
  ): Promise<SpaceOverviewActor[]> {
    const edits = await this.db
      .selectFrom('pages')
      .select(['lastUpdatedById as actor', 'updatedAt as at'])
      .where('spaceId', '=', spaceId)
      .where('deletedAt', 'is', null)
      .where('lastUpdatedById', 'is not', null)
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .execute();

    const commits = await this.db
      .selectFrom('pageVersions')
      .select(['creatorId as actor', 'createdAt as at'])
      .where('spaceId', '=', spaceId)
      .where('discardedAt', 'is', null)
      .where('creatorId', 'is not', null)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .execute();

    const reviews = await this.db
      .selectFrom('reviews')
      .select(['creatorId as actor', 'createdAt as at'])
      .where('spaceId', '=', spaceId)
      .where('deletedAt', 'is', null)
      .where('creatorId', 'is not', null)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .execute();

    const latest = new Map<string, { at: Date; kind: SpaceOverviewActor['kind'] }>();
    const absorb = (
      rows: Array<{ actor: string | null; at: Date }>,
      kind: SpaceOverviewActor['kind'],
    ) => {
      for (const row of rows) {
        if (!row.actor) continue;
        const at = new Date(row.at);
        const prev = latest.get(row.actor);
        if (!prev || prev.at < at) latest.set(row.actor, { at, kind });
      }
    };

    absorb(edits, 'edit');
    absorb(commits, 'commit');
    absorb(reviews, 'review');

    const top = [...latest.entries()]
      .sort((a, b) => b[1].at.getTime() - a[1].at.getTime())
      .slice(0, limit);

    if (top.length === 0) return [];

    const users = await this.db
      .selectFrom('users')
      .select(['id', 'name', 'avatarUrl'])
      .where(
        'id',
        'in',
        top.map(([id]) => id),
      )
      .execute();

    const userById = new Map(users.map((u) => [u.id, u]));

    return top
      .filter(([id]) => userById.has(id))
      .map(([id, meta]) => ({
        id,
        name: userById.get(id)?.name ?? null,
        avatarUrl: userById.get(id)?.avatarUrl ?? null,
        lastActiveAt: meta.at,
        kind: meta.kind,
      }));
  }

  private async getActivityCounts(spaceId: string, recentSince: Date) {
    const commits = await this.db
      .selectFrom('pageVersions')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('spaceId', '=', spaceId)
      .where('discardedAt', 'is', null)
      .where('createdAt', '>=', recentSince)
      .executeTakeFirst();

    const openReviews = await this.db
      .selectFrom('reviews')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('spaceId', '=', spaceId)
      .where('deletedAt', 'is', null)
      .where('resolvedAt', 'is', null)
      .executeTakeFirst();

    const workingDocs = await this.db
      .selectFrom('pageWorkingDocs')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('spaceId', '=', spaceId)
      .executeTakeFirst();

    return {
      recentCommits: Number(commits?.total ?? 0),
      openReviews: Number(openReviews?.total ?? 0),
      workingDocs: Number(workingDocs?.total ?? 0),
    };
  }
}
