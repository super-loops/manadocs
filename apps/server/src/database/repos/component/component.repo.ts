import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB, KyselyTransaction } from '@manadocs/db/types/kysely.types';
import { dbOrTx } from '@manadocs/db/utils';
import {
  Component,
  ComponentCollection,
  ComponentRevision,
  ComponentUploadTicket,
  InsertableComponent,
  InsertableComponentCollection,
  InsertableComponentRevision,
  InsertableComponentUploadTicket,
  UpdatableComponent,
  UpdatableComponentCollection,
} from '@manadocs/db/types/entity.types';

export type ComponentWithCollection = Component & {
  collectionName: string;
  latestFileName: string | null;
  latestAttachmentId: string | null;
  latestFileSize: string | number | null;
  latestMimeType: string | null;
  latestCreatedAt: Date | null;
};

/**
 * 컴포넌트 묶음·컴포넌트·리비전·업로드 티켓.
 * 모든 조회는 «살아 있는 것»(deleted_at IS NULL) 기준이다.
 */
@Injectable()
export class ComponentRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  // ── 묶음 ────────────────────────────────────────────────────────
  async listCollections(spaceId: string) {
    return this.db
      .selectFrom('componentCollections as cc')
      .select([
        'cc.id',
        'cc.name',
        'cc.description',
        'cc.position',
        'cc.spaceId',
        'cc.createdAt',
        'cc.updatedAt',
      ])
      .select((eb) =>
        eb
          .selectFrom('components as c')
          .select((e) => e.fn.countAll<number>().as('cnt'))
          .whereRef('c.collectionId', '=', 'cc.id')
          .where('c.deletedAt', 'is', null)
          .as('componentCount'),
      )
      .where('cc.spaceId', '=', spaceId)
      .where('cc.deletedAt', 'is', null)
      .orderBy('cc.position', 'asc')
      .orderBy('cc.createdAt', 'asc')
      .execute();
  }

  async findCollectionById(
    id: string,
    trx?: KyselyTransaction,
  ): Promise<ComponentCollection | undefined> {
    return dbOrTx(this.db, trx)
      .selectFrom('componentCollections')
      .selectAll()
      .where('id', '=', id)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findCollectionByName(spaceId: string, name: string) {
    return this.db
      .selectFrom('componentCollections')
      .selectAll()
      .where('spaceId', '=', spaceId)
      .where(sql`lower(name)`, '=', name.toLowerCase())
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async insertCollection(
    values: InsertableComponentCollection,
    trx?: KyselyTransaction,
  ) {
    return dbOrTx(this.db, trx)
      .insertInto('componentCollections')
      .values(values)
      .returningAll()
      .executeTakeFirst();
  }

  async updateCollection(
    values: UpdatableComponentCollection,
    id: string,
    trx?: KyselyTransaction,
  ) {
    return dbOrTx(this.db, trx)
      .updateTable('componentCollections')
      .set({ ...values, updatedAt: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
  }

  async nextCollectionPosition(spaceId: string): Promise<number> {
    const row = await this.db
      .selectFrom('componentCollections')
      .select((eb) => eb.fn.max('position').as('maxPos'))
      .where('spaceId', '=', spaceId)
      .executeTakeFirst();
    return Number(row?.maxPos ?? -1) + 1;
  }

  // ── 컴포넌트 ────────────────────────────────────────────────────
  private componentQuery(trx?: KyselyTransaction) {
    return dbOrTx(this.db, trx)
      .selectFrom('components as c')
      .innerJoin('componentCollections as cc', 'cc.id', 'c.collectionId')
      .leftJoin('componentRevisions as r', (join) =>
        join
          .onRef('r.componentId', '=', 'c.id')
          .onRef('r.revision', '=', 'c.currentRevision'),
      )
      .selectAll('c')
      .select([
        'cc.name as collectionName',
        'r.fileName as latestFileName',
        'r.attachmentId as latestAttachmentId',
        'r.fileSize as latestFileSize',
        'r.mimeType as latestMimeType',
        'r.createdAt as latestCreatedAt',
      ])
      .where('c.deletedAt', 'is', null);
  }

  async listComponents(opts: {
    spaceId: string;
    collectionId?: string;
    query?: string;
    kind?: string;
    emptyOnly?: boolean;
    limit?: number;
  }): Promise<ComponentWithCollection[]> {
    let q = this.componentQuery().where('c.spaceId', '=', opts.spaceId);
    if (opts.collectionId) q = q.where('c.collectionId', '=', opts.collectionId);
    if (opts.kind) q = q.where('c.kind', '=', opts.kind);
    if (opts.emptyOnly) q = q.where('c.currentRevision', '=', 0);
    if (opts.query) {
      const like = `%${opts.query.toLowerCase()}%`;
      q = q.where((eb) =>
        eb.or([
          eb(sql`lower(c.slug)`, 'like', like),
          eb(sql`lower(coalesce(c.description, ''))`, 'like', like),
        ]),
      );
    }
    return (await q
      .orderBy('c.updatedAt', 'desc')
      .limit(opts.limit ?? 200)
      .execute()) as ComponentWithCollection[];
  }

  async findById(
    id: string,
    trx?: KyselyTransaction,
  ): Promise<ComponentWithCollection | undefined> {
    return (await this.componentQuery(trx)
      .where('c.id', '=', id)
      .executeTakeFirst()) as ComponentWithCollection | undefined;
  }

  async findBySlug(
    spaceId: string,
    slug: string,
    trx?: KyselyTransaction,
  ): Promise<ComponentWithCollection | undefined> {
    return (await this.componentQuery(trx)
      .where('c.spaceId', '=', spaceId)
      .where('c.slug', '=', slug)
      .executeTakeFirst()) as ComponentWithCollection | undefined;
  }

  async findByIds(ids: string[]): Promise<ComponentWithCollection[]> {
    if (ids.length === 0) return [];
    return (await this.componentQuery()
      .where('c.id', 'in', ids)
      .execute()) as ComponentWithCollection[];
  }

  async lockById(id: string, trx: KyselyTransaction) {
    return trx
      .selectFrom('components')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
  }

  async insertComponent(values: InsertableComponent, trx?: KyselyTransaction) {
    return dbOrTx(this.db, trx)
      .insertInto('components')
      .values(values)
      .returningAll()
      .executeTakeFirst();
  }

  async updateComponent(
    values: UpdatableComponent,
    id: string,
    trx?: KyselyTransaction,
  ) {
    return dbOrTx(this.db, trx)
      .updateTable('components')
      .set({ ...values, updatedAt: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
  }

  async countLiveInCollection(collectionId: string): Promise<number> {
    const row = await this.db
      .selectFrom('components')
      .select((eb) => eb.fn.countAll<number>().as('cnt'))
      .where('collectionId', '=', collectionId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
    return Number(row?.cnt ?? 0);
  }

  // ── 리비전 ──────────────────────────────────────────────────────
  async listRevisions(componentId: string) {
    return this.db
      .selectFrom('componentRevisions as r')
      .leftJoin('users as u', 'u.id', 'r.creatorId')
      .selectAll('r')
      .select(['u.name as creatorName'])
      .where('r.componentId', '=', componentId)
      .orderBy('r.revision', 'desc')
      .execute();
  }

  async findRevision(
    componentId: string,
    revision: number,
  ): Promise<ComponentRevision | undefined> {
    return this.db
      .selectFrom('componentRevisions')
      .selectAll()
      .where('componentId', '=', componentId)
      .where('revision', '=', revision)
      .executeTakeFirst();
  }

  async insertRevision(
    values: InsertableComponentRevision,
    trx?: KyselyTransaction,
  ) {
    return dbOrTx(this.db, trx)
      .insertInto('componentRevisions')
      .values(values)
      .returningAll()
      .executeTakeFirst();
  }

  // ── 업로드 티켓 ────────────────────────────────────────────────
  async insertTicket(
    values: InsertableComponentUploadTicket,
  ): Promise<ComponentUploadTicket> {
    return this.db
      .insertInto('componentUploadTickets')
      .values(values)
      .returningAll()
      .executeTakeFirst();
  }

  async findTicketByToken(
    token: string,
    trx?: KyselyTransaction,
  ): Promise<ComponentUploadTicket | undefined> {
    return dbOrTx(this.db, trx)
      .selectFrom('componentUploadTickets')
      .selectAll()
      .where('token', '=', token)
      .executeTakeFirst();
  }

  async lockTicket(id: string, trx: KyselyTransaction) {
    return trx
      .selectFrom('componentUploadTickets')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
  }

  async consumeTicket(id: string, trx?: KyselyTransaction) {
    return dbOrTx(this.db, trx)
      .updateTable('componentUploadTickets')
      .set({ consumedAt: new Date() })
      .where('id', '=', id)
      .execute();
  }

  /** 티켓을 발급한 토큰이 아직 살아 있나 — 폐기·만료된 토큰의 티켓은 쓸 수 없다 */
  async isApiTokenActive(apiTokenId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('apiTokens')
      .select(['id', 'expiresAt'])
      .where('id', '=', apiTokenId)
      .executeTakeFirst();
    if (!row) return false;
    return !row.expiresAt || new Date(row.expiresAt).getTime() > Date.now();
  }

  /** 만료 하루가 지난 티켓 청소 — 스케줄러 없이 발급 때 함께 돈다 */
  async sweepTickets() {
    await this.db
      .deleteFrom('componentUploadTickets')
      .where('expiresAt', '<', sql<Date>`now() - interval '1 day'`)
      .execute();
  }

  // ── 사용처 ──────────────────────────────────────────────────────
  /**
   * 본문 JSON 에 이 컴포넌트 id 가 들어 있는 작업문서. 색인을 두지 않고 텍스트로
   * 찾은 뒤, 호출자가 JSON 을 걸어 실제 인스턴스인지 확인한다.
   */
  async findWorkingDocsReferencing(spaceId: string, componentId: string) {
    return this.db
      .selectFrom('pageWorkingDocs as wd')
      .innerJoin('pages as p', 'p.id', 'wd.pageId')
      .select([
        'wd.id as workingDocId',
        'wd.pageId',
        'wd.name as workingDocName',
        'wd.content',
        'p.title',
        'p.slugId',
        'p.icon',
        'p.primaryWorkingDocId',
        'p.parentPageId',
      ])
      .where('wd.spaceId', '=', spaceId)
      .where('p.deletedAt', 'is', null)
      .where(sql`wd.content::text`, 'like', `%${componentId}%`)
      .execute();
  }

  async findCommittedPagesReferencing(spaceId: string, componentId: string) {
    return this.db
      .selectFrom('pages as p')
      .innerJoin('pageVersions as v', 'v.id', 'p.primaryVersionId')
      .select(['p.id as pageId', 'p.title', 'p.slugId', 'v.version', 'v.content'])
      .where('p.spaceId', '=', spaceId)
      .where('p.deletedAt', 'is', null)
      .where(sql`v.content::text`, 'like', `%${componentId}%`)
      .execute();
  }
}
