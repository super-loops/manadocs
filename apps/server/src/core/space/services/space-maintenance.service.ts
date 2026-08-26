import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@manadocs/db/types/kysely.types';

export const maintenanceIssueKinds = [
  'empty',
  'untitled',
  'staleUncommitted',
  'integrity',
] as const;

export type MaintenanceIssueKind = (typeof maintenanceIssueKinds)[number];

export interface MaintenancePageRow {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  updatedAt: Date;
  createdAt: Date;
  /** integrity 항목에서만 채워지는 세부 사유 코드 */
  detail?: string;
  /**
   * 이 페이지를 휴지통으로 보낼 때 함께 딸려가는 살아있는 하위 페이지 수
   * (자기 자신 제외). 휴지통 이동은 하위 트리 전체를 캐스케이드하므로
   * 화면이 «몇 건이 지워지는가» 를 말할 수 있어야 한다.
   */
  descendantCount: number;
}

export interface MaintenanceGroup {
  kind: MaintenanceIssueKind;
  count: number;
  items: MaintenancePageRow[];
}

/** 그룹당 반환 상한 — 스캔 결과가 폭주해도 화면이 버티게 */
const MAX_ITEMS_PER_GROUP = 100;

/** 장기 미확정 기준(일) */
const STALE_DAYS = 30;

/**
 * "잘못된 페이지를 찾아서 정리" 스캔. 읽기 전용이며, 정리 액션은
 * 기존 /pages/delete (휴지통) 를 클라이언트가 그대로 호출한다.
 */
@Injectable()
export class SpaceMaintenanceService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async scan(spaceId: string): Promise<{
    groups: MaintenanceGroup[];
    staleDays: number;
    scannedAt: Date;
  }> {
    const staleBefore = new Date();
    staleBefore.setDate(staleBefore.getDate() - STALE_DAYS);

    const [empty, untitled, stale, integrity] = await Promise.all([
      this.findEmptyPages(spaceId),
      this.findUntitledPages(spaceId),
      this.findStaleUncommitted(spaceId, staleBefore),
      this.findIntegrityIssues(spaceId),
    ]);

    const groups = [empty, untitled, stale, integrity];
    await this.attachDescendantCounts(groups);

    return {
      groups,
      staleDays: STALE_DAYS,
      scannedAt: new Date(),
    };
  }

  /**
   * 각 행에 «함께 휴지통으로 갈 하위 페이지 수» 를 채운다.
   * PageRepo.removePage 가 재귀 CTE 로 하위 트리 전체를 soft-delete 하므로,
   * 그 폭발 반경을 지우기 전에 화면에서 볼 수 있어야 한다.
   */
  private async attachDescendantCounts(
    groups: MaintenanceGroup[],
  ): Promise<void> {
    const rows = groups.flatMap((group) => group.items);
    const ids = [...new Set(rows.map((row) => row.id))];

    const counts = await this.countLiveDescendants(ids);
    for (const row of rows) {
      row.descendantCount = counts.get(row.id) ?? 0;
    }
  }

  /** pageId -> 살아있는 하위 페이지 수(자기 자신 제외) */
  private async countLiveDescendants(
    pageIds: string[],
  ): Promise<Map<string, number>> {
    if (pageIds.length === 0) return new Map();

    const rows = await this.db
      .withRecursive('subtree', (qb) =>
        qb
          .selectFrom('pages')
          .select(['pages.id as rootId', 'pages.id as descendantId'])
          .where('pages.id', 'in', pageIds)
          .where('pages.deletedAt', 'is', null)
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin(
                'subtree',
                'subtree.descendantId',
                'pages.parentPageId',
              )
              .select(['subtree.rootId as rootId', 'pages.id as descendantId'])
              .where('pages.deletedAt', 'is', null),
          ),
      )
      .selectFrom('subtree')
      .select('subtree.rootId')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .groupBy('subtree.rootId')
      .execute();

    // 앵커 행(자기 자신)이 1건 섞여 있으니 뺀다
    return new Map(
      rows.map((row) => [row.rootId, Math.max(0, Number(row.total) - 1)]),
    );
  }

  /**
   * livePages() 결과를 MaintenancePageRow 로 승격한다.
   * descendantCount 는 attachDescendantCounts() 가 한 번에 채운다.
   */
  private toRows(rows: any[], detail?: string): MaintenancePageRow[] {
    return rows.map((row) => ({
      ...row,
      ...(detail ? { detail } : {}),
      descendantCount: 0,
    }));
  }

  private livePages(spaceId: string) {
    return this.db
      .selectFrom('pages')
      .select([
        'pages.id',
        'pages.slugId',
        'pages.title',
        'pages.icon',
        'pages.createdAt',
        'pages.updatedAt',
      ])
      .where('pages.spaceId', '=', spaceId)
      .where('pages.deletedAt', 'is', null);
  }

  /** (a) 제목도 내용도 없는 페이지 */
  private async findEmptyPages(spaceId: string): Promise<MaintenanceGroup> {
    const blankTitle = (eb: any) =>
      eb.or([eb('pages.title', 'is', null), eb('pages.title', '=', '')]);
    const blankText = (eb: any) =>
      eb.or([
        eb('pages.textContent', 'is', null),
        eb(eb.fn('btrim', ['pages.textContent']), '=', ''),
      ]);

    const items = await this.livePages(spaceId)
      .where((eb) => eb.and([blankTitle(eb), blankText(eb)]))
      .orderBy('pages.updatedAt', 'desc')
      .limit(MAX_ITEMS_PER_GROUP)
      .execute();

    const count = await this.countLive(spaceId, (eb) =>
      eb.and([blankTitle(eb), blankText(eb)]),
    );

    return { kind: 'empty', count, items: this.toRows(items) };
  }

  /** (b) 제목만 없는 페이지 (내용은 있음 — 빈 페이지와 겹치지 않게) */
  private async findUntitledPages(spaceId: string): Promise<MaintenanceGroup> {
    const predicate = (eb: any) =>
      eb.and([
        eb.or([eb('pages.title', 'is', null), eb('pages.title', '=', '')]),
        eb('pages.textContent', 'is not', null),
        eb(eb.fn('btrim', ['pages.textContent']), '!=', ''),
      ]);

    const items = await this.livePages(spaceId)
      .where(predicate)
      .orderBy('pages.updatedAt', 'desc')
      .limit(MAX_ITEMS_PER_GROUP)
      .execute();

    const count = await this.countLive(spaceId, predicate);

    return { kind: 'untitled', count, items: this.toRows(items) };
  }

  /** (c) 확정본 0 + 오래 손대지 않은 페이지 */
  private async findStaleUncommitted(
    spaceId: string,
    staleBefore: Date,
  ): Promise<MaintenanceGroup> {
    const predicate = (eb: any) =>
      eb.and([
        eb('pages.primaryVersionId', 'is', null),
        eb('pages.updatedAt', '<', staleBefore),
      ]);

    const items = await this.livePages(spaceId)
      .where(predicate)
      .orderBy('pages.updatedAt', 'asc')
      .limit(MAX_ITEMS_PER_GROUP)
      .execute();

    const count = await this.countLive(spaceId, predicate);

    return { kind: 'staleUncommitted', count, items: this.toRows(items) };
  }

  /**
   * (d) 형상관리 무결성 이상
   *  - orphanVersions: primaryVersionId 는 비었는데 확정 버전 행은 있다
   *  - danglingPrimary: primaryVersionId 가 없는/폐기된 버전을 가리킨다
   *  - danglingWorkingDoc: primaryWorkingDocId 가 없는 작업문서를 가리킨다
   */
  private async findIntegrityIssues(
    spaceId: string,
  ): Promise<MaintenanceGroup> {
    const orphanVersions = await this.livePages(spaceId)
      .where('pages.primaryVersionId', 'is', null)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom('pageVersions')
            .select('pageVersions.id')
            .whereRef('pageVersions.pageId', '=', 'pages.id')
            .where('pageVersions.discardedAt', 'is', null)
            // version 0 은 페이지 생성 마커라 미확정 페이지에도 항상 달려 있다.
            // 이걸 세면 정상 미확정이 전부 "데이터 이상"으로 잡히고
            // "장기 미확정" 카테고리와 역할도 겹친다. 실제 확정본만 본다.
            .where('pageVersions.version', '>', 0),
        ),
      )
      .limit(MAX_ITEMS_PER_GROUP)
      .execute();

    const danglingPrimary = await this.livePages(spaceId)
      .where('pages.primaryVersionId', 'is not', null)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('pageVersions')
              .select('pageVersions.id')
              .whereRef('pageVersions.id', '=', 'pages.primaryVersionId')
              .where('pageVersions.discardedAt', 'is', null),
          ),
        ),
      )
      .limit(MAX_ITEMS_PER_GROUP)
      .execute();

    const danglingWorkingDoc = await this.livePages(spaceId)
      .where('pages.primaryWorkingDocId', 'is not', null)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('pageWorkingDocs')
              .select('pageWorkingDocs.id')
              .whereRef('pageWorkingDocs.id', '=', 'pages.primaryWorkingDocId'),
          ),
        ),
      )
      .limit(MAX_ITEMS_PER_GROUP)
      .execute();

    const byId = new Map<string, MaintenancePageRow>();
    const absorb = (rows: any[], detail: string) => {
      for (const row of this.toRows(rows, detail)) {
        const existing = byId.get(row.id);
        if (existing) {
          existing.detail = `${existing.detail}, ${detail}`;
        } else {
          byId.set(row.id, row);
        }
      }
    };

    absorb(orphanVersions, 'orphanVersions');
    absorb(danglingPrimary, 'danglingPrimary');
    absorb(danglingWorkingDoc, 'danglingWorkingDoc');

    const items = [...byId.values()].slice(0, MAX_ITEMS_PER_GROUP);

    return { kind: 'integrity', count: items.length, items };
  }

  private async countLive(
    spaceId: string,
    predicate: (eb: any) => any,
  ): Promise<number> {
    const row = await this.db
      .selectFrom('pages')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('pages.spaceId', '=', spaceId)
      .where('pages.deletedAt', 'is', null)
      .where(predicate)
      .executeTakeFirst();
    return Number(row?.total ?? 0);
  }
}
