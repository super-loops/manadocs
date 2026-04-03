import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@manadocs/db/types/kysely.types';
import { dbOrTx } from '@manadocs/db/utils';
import { InsertableAudit, Audit } from '@manadocs/db/types/entity.types';

export interface AuditListOptions {
  workspaceId: string;
  limit?: number;
  offset?: number;
  event?: string;
  actorId?: string;
  resourceType?: string;
  spaceId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AuditListResult {
  items: Audit[];
  total: number;
}

@Injectable()
export class AuditRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insert(
    data: InsertableAudit,
    trx?: KyselyTransaction,
  ): Promise<Audit> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('audit')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async insertMany(
    items: InsertableAudit[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (items.length === 0) return;
    const db = dbOrTx(this.db, trx);
    await db.insertInto('audit').values(items).execute();
  }

  async list(opts: AuditListOptions): Promise<AuditListResult> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    let query = this.db
      .selectFrom('audit')
      .where('workspaceId', '=', opts.workspaceId);

    let countQuery = this.db
      .selectFrom('audit')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('workspaceId', '=', opts.workspaceId);

    if (opts.event) {
      query = query.where('event', '=', opts.event);
      countQuery = countQuery.where('event', '=', opts.event);
    }

    if (opts.actorId) {
      query = query.where('actorId', '=', opts.actorId);
      countQuery = countQuery.where('actorId', '=', opts.actorId);
    }

    if (opts.resourceType) {
      query = query.where('resourceType', '=', opts.resourceType);
      countQuery = countQuery.where('resourceType', '=', opts.resourceType);
    }

    if (opts.spaceId) {
      query = query.where('spaceId', '=', opts.spaceId);
      countQuery = countQuery.where('spaceId', '=', opts.spaceId);
    }

    if (opts.startDate) {
      query = query.where('createdAt', '>=', opts.startDate);
      countQuery = countQuery.where('createdAt', '>=', opts.startDate);
    }

    if (opts.endDate) {
      query = query.where('createdAt', '<=', opts.endDate);
      countQuery = countQuery.where('createdAt', '<=', opts.endDate);
    }

    const [items, countResult] = await Promise.all([
      query
        .selectAll()
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    return {
      items,
      total: Number(countResult.count),
    };
  }

  async deleteOlderThan(
    workspaceId: string,
    beforeDate: Date,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('audit')
      .where('workspaceId', '=', workspaceId)
      .where('createdAt', '<', beforeDate)
      .execute();
  }
}
