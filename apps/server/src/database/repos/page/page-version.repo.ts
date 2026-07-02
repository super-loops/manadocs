import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertablePageVersion,
  Page,
  PageVersion,
} from '@manadocs/db/types/entity.types';
import { PaginationOptions } from '@manadocs/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@manadocs/db/pagination/cursor-pagination';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { ExpressionBuilder, sql } from 'kysely';
import { DB } from '@manadocs/db/types/db';

@Injectable()
export class PageVersionRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof PageVersion> = [
    'id',
    'pageId',
    'version',
    'title',
    'icon',
    'coverPhoto',
    'message',
    'creatorId',
    'contributorIds',
    'workingDocId',
    'discardedAt',
    'discardedById',
    'spaceId',
    'workspaceId',
    'createdAt',
    'updatedAt',
  ];

  async findById(
    versionId: string,
    opts?: {
      includeContent?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<PageVersion> {
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('pageVersions')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .select((eb) => this.withCreator(eb))
      .select((eb) => this.withContributors(eb))
      .where('id', '=', versionId)
      .executeTakeFirst();
  }

  async findByPageAndVersion(
    pageId: string,
    version: number,
    opts?: { includeContent?: boolean; trx?: KyselyTransaction },
  ): Promise<PageVersion> {
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('pageVersions')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .where('pageId', '=', pageId)
      .where('version', '=', version)
      .executeTakeFirst();
  }

  async findVersionsByPageId(pageId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pageVersions')
      .select(this.baseFields)
      .select((eb) => this.withCreator(eb))
      .select((eb) => this.withContributors(eb))
      .where('pageId', '=', pageId);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'version', direction: 'desc' }],
      parseCursor: (cursor) => ({ version: Number(cursor.version) }),
    });
  }

  async maxVersion(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<number | null> {
    const db = dbOrTx(this.db, trx);
    const row = await db
      .selectFrom('pageVersions')
      .select((eb) => eb.fn.max('version').as('max'))
      .where('pageId', '=', pageId)
      .executeTakeFirst();
    return row?.max ?? null;
  }

  async insertVersion(
    insertableVersion: InsertablePageVersion,
    trx?: KyselyTransaction,
  ): Promise<PageVersion> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('pageVersions')
      .values(insertableVersion)
      .returningAll()
      .executeTakeFirst();
  }

  async updateVersion(
    updatableVersion: Partial<PageVersion>,
    versionId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('pageVersions')
      .set({ ...updatableVersion, updatedAt: new Date() })
      .where('id', '=', versionId)
      .execute();
  }

  /**
   * 폐기 fallback 대상 — 기준 버전에서 가장 가까운 비폐기 버전.
   * 거리가 같으면 이전(낮은) 버전 우선. 버전 0(생성 마커)은 제외.
   */
  async findNearestActiveVersion(
    pageId: string,
    aroundVersion: number,
    opts?: { includeContent?: boolean; trx?: KyselyTransaction },
  ): Promise<PageVersion | undefined> {
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('pageVersions')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .where('pageId', '=', pageId)
      .where('discardedAt', 'is', null)
      .where('version', '>', 0)
      .orderBy(sql`abs(version - ${aroundVersion})`, 'asc')
      .orderBy('version', 'asc')
      .limit(1)
      .executeTakeFirst();
  }

  /**
   * 페이지 형상관리 스캐폴드 생성 — 작업문서(Primary) + 버전 0(생성 마커).
   * autoCommitVersion1 이면 현재 본문을 버전 1로 자동 확정(가져오기/마이그레이션 시맨틱).
   * 신규 생성 경로와 lazy-repair(구 코드 경로로 생성된 페이지) 양쪽에서 사용.
   */
  async createPageScaffold(
    page: Page,
    userId: string | null,
    opts?: {
      autoCommitVersion1?: boolean;
      commitMessage?: string;
      trx?: KyselyTransaction;
    },
  ): Promise<{ workingDocId: string; primaryVersionId: string | null }> {
    const db = dbOrTx(this.db, opts?.trx);
    const creatorId = userId ?? page.lastUpdatedById ?? page.creatorId ?? null;

    const workingDoc = await db
      .insertInto('pageWorkingDocs')
      .values({
        pageId: page.id,
        content: (page as any).content ?? null,
        ydoc: (page as any).ydoc ?? null,
        textContent: (page as any).textContent ?? null,
        creatorId,
        contributorIds: page.contributorIds ?? [],
        spaceId: page.spaceId,
        workspaceId: page.workspaceId,
      })
      .returning('id')
      .executeTakeFirst();

    await db
      .insertInto('pageVersions')
      .values({
        pageId: page.id,
        version: 0,
        title: page.title,
        icon: page.icon,
        coverPhoto: page.coverPhoto,
        content: null,
        message: '페이지 생성',
        creatorId: page.creatorId ?? creatorId,
        contributorIds: [],
        spaceId: page.spaceId,
        workspaceId: page.workspaceId,
      })
      .execute();

    let primaryVersionId: string | null = null;

    if (opts?.autoCommitVersion1) {
      const v1 = await db
        .insertInto('pageVersions')
        .values({
          pageId: page.id,
          version: 1,
          title: page.title,
          icon: page.icon,
          coverPhoto: page.coverPhoto,
          content:
            (page as any).content ?? sql`'{"type":"doc","content":[]}'::jsonb`,
          message: opts?.commitMessage ?? '기존 문서 자동 확정',
          creatorId,
          contributorIds: page.contributorIds ?? [],
          workingDocId: workingDoc.id,
          spaceId: page.spaceId,
          workspaceId: page.workspaceId,
        })
        .returning('id')
        .executeTakeFirst();

      primaryVersionId = v1.id;

      await db
        .updateTable('pageWorkingDocs')
        .set({ baseVersionId: v1.id })
        .where('id', '=', workingDoc.id)
        .execute();
    }

    await db
      .updateTable('pages')
      .set({
        primaryWorkingDocId: workingDoc.id,
        primaryVersionId,
        ...(opts?.autoCommitVersion1
          ? { committedTextContent: (page as any).textContent ?? null }
          : {}),
      })
      .where('id', '=', page.id)
      .execute();

    return { workingDocId: workingDoc.id, primaryVersionId };
  }

  /**
   * 페이지의 Primary 작업문서 id 해석 — 스캐폴드가 없으면 자가 수복.
   * 서버측 협업 room 접속(REST/MCP 직접 연결) 전 반드시 이걸로 명시
   * room 이름을 만들어야 클라이언트와 같은 문서를 공유한다.
   */
  async resolvePrimaryWorkingDocId(pageId: string): Promise<string | null> {
    const page = await this.db
      .selectFrom('pages')
      .selectAll()
      .where('id', '=', pageId)
      .executeTakeFirst();

    if (!page) return null;
    if (page.primaryWorkingDocId) return page.primaryWorkingDocId;

    const { workingDocId } = await this.createPageScaffold(page as any, null);
    return workingDocId;
  }

  withCreator(eb: ExpressionBuilder<DB, 'pageVersions'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pageVersions.creatorId'),
    ).as('creator');
  }

  withContributors(eb: ExpressionBuilder<DB, 'pageVersions'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef(
          'users.id',
          '=',
          sql`ANY(${eb.ref('pageVersions.contributorIds')})`,
        ),
    ).as('contributors');
  }
}
