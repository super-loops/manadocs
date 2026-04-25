import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  ReviewHistory,
  InsertableReviewHistory,
  UpdatableReviewHistory,
} from '@manadocs/db/types/entity.types';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@manadocs/db/types/db';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

@Injectable()
export class ReviewHistoryRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByReviewId(reviewId: string): Promise<ReviewHistory[]> {
    return this.db
      .selectFrom('reviewHistories')
      .selectAll('reviewHistories')
      .select((eb) => this.withCreator(eb))
      .where('reviewId', '=', reviewId)
      .orderBy('createdAt', 'asc')
      .execute();
  }

  async findById(historyId: string): Promise<ReviewHistory | undefined> {
    return this.db
      .selectFrom('reviewHistories')
      .selectAll('reviewHistories')
      .where('id', '=', historyId)
      .executeTakeFirst();
  }

  async insertHistory(
    data: InsertableReviewHistory,
    trx?: KyselyTransaction,
  ): Promise<ReviewHistory> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('reviewHistories')
      .values(data)
      .returningAll()
      .executeTakeFirst();
  }

  async updateHistory(
    data: UpdatableReviewHistory,
    historyId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('reviewHistories')
      .set(data)
      .where('id', '=', historyId)
      .execute();
  }

  async deleteHistory(historyId: string) {
    await this.db
      .updateTable('reviewHistories')
      .set({ deletedAt: new Date() })
      .where('id', '=', historyId)
      .execute();
  }

  private withCreator(eb: ExpressionBuilder<DB, 'reviewHistories'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'reviewHistories.creatorId'),
    ).as('creator');
  }
}
