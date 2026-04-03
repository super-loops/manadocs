import {
  InsertableApiToken,
  UpdatableApiToken,
  ApiToken,
} from '@manadocs/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@manadocs/db/types/kysely.types';
import { dbOrTx } from '@manadocs/db/utils';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';

function requireId(value: string | undefined | null, field: string): string {
  if (!value) {
    throw new BadRequestException(`api-tokens: ${field} is required`);
  }
  return value;
}

@Injectable()
export class ApiTokenRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    id: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<ApiToken | undefined> {
    requireId(id, 'id');
    requireId(workspaceId, 'workspaceId');
    const db = dbOrTx(this.db, trx);

    return db
      .selectFrom('apiTokens')
      .selectAll()
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findByTokenHash(
    tokenHash: string,
    trx?: KyselyTransaction,
  ): Promise<ApiToken | undefined> {
    const db = dbOrTx(this.db, trx);

    return db
      .selectFrom('apiTokens')
      .selectAll()
      .where('tokenHash', '=', tokenHash)
      .executeTakeFirst();
  }

  async findByUserId(
    userId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<ApiToken[]> {
    requireId(userId, 'userId');
    requireId(workspaceId, 'workspaceId');
    const db = dbOrTx(this.db, trx);

    return db
      .selectFrom('apiTokens')
      .selectAll()
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .orderBy('createdAt', 'desc')
      .execute();
  }

  async insert(
    insertableApiToken: InsertableApiToken,
    opts?: { trx?: KyselyTransaction },
  ): Promise<ApiToken> {
    requireId(insertableApiToken.userId as any, 'userId');
    requireId(insertableApiToken.workspaceId as any, 'workspaceId');
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .insertInto('apiTokens')
      .values(insertableApiToken)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(
    id: string,
    updatableApiToken: UpdatableApiToken,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);

    await db
      .updateTable('apiTokens')
      .set(updatableApiToken)
      .where('id', '=', id)
      .execute();
  }

  async delete(id: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);

    await db.deleteFrom('apiTokens').where('id', '=', id).execute();
  }

  async findValidSpaceIdsForWorkspace(
    spaceIds: string[],
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    if (spaceIds.length === 0) return [];
    const db = dbOrTx(this.db, trx);
    const rows = await db
      .selectFrom('spaces')
      .select('id')
      .where('id', 'in', spaceIds)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
    return rows.map((r) => r.id);
  }

  async findSpaceIdsByTokenId(
    apiTokenId: string,
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    const db = dbOrTx(this.db, trx);
    const rows = await db
      .selectFrom('apiTokenSpaces')
      .select('spaceId')
      .where('apiTokenId', '=', apiTokenId)
      .execute();
    return rows.map((r) => r.spaceId);
  }

  async findSpacesByTokenId(
    apiTokenId: string,
    trx?: KyselyTransaction,
  ): Promise<Array<{ id: string; name: string | null; slug: string }>> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('apiTokenSpaces')
      .innerJoin('spaces', 'spaces.id', 'apiTokenSpaces.spaceId')
      .select(['spaces.id', 'spaces.name', 'spaces.slug'])
      .where('apiTokenSpaces.apiTokenId', '=', apiTokenId)
      .execute();
  }

  async replaceTokenSpaces(
    apiTokenId: string,
    spaceIds: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('apiTokenSpaces')
      .where('apiTokenId', '=', apiTokenId)
      .execute();

    if (spaceIds.length === 0) return;

    const unique = Array.from(new Set(spaceIds));
    await db
      .insertInto('apiTokenSpaces')
      .values(unique.map((spaceId) => ({ apiTokenId, spaceId })))
      .execute();
  }

  async deleteExpiredTokens(trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx);

    await db
      .deleteFrom('apiTokens')
      .where('expiresAt', '<', new Date())
      .execute();
  }
}
