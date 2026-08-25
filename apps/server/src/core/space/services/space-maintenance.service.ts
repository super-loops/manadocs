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

    return {
      groups: [
        empty,
        untitled,
        stale,
        integrity,
      ],
      staleDays: STALE_DAYS,
      scannedAt: new Date(),
    };
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

    return { kind: 'empty', count, items };
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

    return { kind: 'untitled', count, items };
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

    return { kind: 'staleUncommitted', count, items };
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
              .whereRef(
                'pageWorkingDocs.id',
                '=',
                'pages.primaryWorkingDocId',
              ),
          ),
        ),
      )
      .limit(MAX_ITEMS_PER_GROUP)
      .execute();

    const byId = new Map<string, MaintenancePageRow>();
    const absorb = (rows: any[], detail: string) => {
      for (const row of rows) {
        const existing = byId.get(row.id);
        if (existing) {
          existing.detail = `${existing.detail}, ${detail}`;
        } else {
          byId.set(row.id, { ...row, detail });
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
