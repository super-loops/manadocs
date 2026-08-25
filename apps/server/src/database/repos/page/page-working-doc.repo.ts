import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertablePageWorkingDoc,
  PageWorkingDoc,
  UpdatablePageWorkingDoc,
} from '@manadocs/db/types/entity.types';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { ExpressionBuilder, sql } from 'kysely';
import { DB } from '@manadocs/db/types/db';

@Injectable()
export class PageWorkingDocRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof PageWorkingDoc> = [
    'id',
    'pageId',
    'name',
    'baseVersionId',
    'creatorId',
    'contributorIds',
    'spaceId',
    'workspaceId',
    'createdAt',
    'updatedAt',
  ];

  async findById(
    workingDocId: string,
    opts?: {
      includeContent?: boolean;
      includeYdoc?: boolean;
      withLock?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<PageWorkingDoc> {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db
      .selectFrom('pageWorkingDocs')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .$if(opts?.includeYdoc, (qb) => qb.select('ydoc'))
      .where('id', '=', workingDocId);

    if (opts?.withLock && opts?.trx) {
      query = query.forUpdate();
    }

    return query.executeTakeFirst();
  }

  async findByPageId(
    pageId: string,
    opts?: { includeContent?: boolean },
  ): Promise<PageWorkingDoc[]> {
    return this.db
      .selectFrom('pageWorkingDocs')
      .select(this.baseFields)
      .select((eb) => this.withCreator(eb))
      .select((eb) => this.withContributors(eb))
      .select((eb) => this.withBaseVersion(eb))
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .where('pageId', '=', pageId)
      .orderBy('createdAt', 'asc')
      .execute();
  }

  /** 같은 페이지의 다른 작업문서 id 들 — 확정 시 비채택 분기 정리에 쓴다 */
  async findOtherIdsByPageId(
    pageId: string,
    keepWorkingDocId: string,
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    const db = dbOrTx(this.db, trx);
    const rows = await db
      .selectFrom('pageWorkingDocs')
      .select('id')
      .where('pageId', '=', pageId)
      .where('id', '!=', keepWorkingDocId)
      .execute();
    return rows.map((row) => row.id);
  }

  async deleteWorkingDocs(
    workingDocIds: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (workingDocIds.length === 0) return;
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pageWorkingDocs')
      .where('id', 'in', workingDocIds)
      .execute();
  }

  async countByPageId(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<number> {
    const db = dbOrTx(this.db, trx);
    const row = await db
      .selectFrom('pageWorkingDocs')
      .select((eb) => eb.fn.countAll().as('count'))
      .where('pageId', '=', pageId)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  async insertWorkingDoc(
    insertableWorkingDoc: InsertablePageWorkingDoc,
    trx?: KyselyTransaction,
  ): Promise<PageWorkingDoc> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('pageWorkingDocs')
      .values(insertableWorkingDoc)
      .returningAll()
      .executeTakeFirst();
  }

  async updateWorkingDoc(
    updatableWorkingDoc: UpdatablePageWorkingDoc,
    workingDocId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('pageWorkingDocs')
      .set({ ...updatableWorkingDoc, updatedAt: new Date() })
      .where('id', '=', workingDocId)
      .execute();
  }

  async deleteWorkingDoc(
    workingDocId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pageWorkingDocs')
      .where('id', '=', workingDocId)
      .execute();
  }

  withCreator(eb: ExpressionBuilder<DB, 'pageWorkingDocs'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pageWorkingDocs.creatorId'),
    ).as('creator');
  }

  withContributors(eb: ExpressionBuilder<DB, 'pageWorkingDocs'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef(
          'users.id',
          '=',
          sql`ANY(${eb.ref('pageWorkingDocs.contributorIds')})`,
        ),
    ).as('contributors');
  }

  withBaseVersion(eb: ExpressionBuilder<DB, 'pageWorkingDocs'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('pageVersions')
        // createdAt: 이 작업문서의 "수정 시작" 기준 시각(마지막 확정 시점)
        .select([
          'pageVersions.id',
          'pageVersions.version',
          'pageVersions.createdAt',
        ])
        .whereRef('pageVersions.id', '=', 'pageWorkingDocs.baseVersionId'),
    ).as('baseVersion');
  }
}
