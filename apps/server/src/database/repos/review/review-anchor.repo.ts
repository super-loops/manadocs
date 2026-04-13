import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  ReviewAnchor,
  InsertableReviewAnchor,
} from '@manadocs/db/types/entity.types';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@manadocs/db/types/db';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

@Injectable()
export class ReviewAnchorRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(anchorId: string): Promise<ReviewAnchor> {
    return this.db
      .selectFrom('reviewAnchors')
      .selectAll('reviewAnchors')
      .where('id', '=', anchorId)
      .executeTakeFirst();
  }

  async findByPageId(pageId: string): Promise<ReviewAnchor[]> {
    return this.db
      .selectFrom('reviewAnchors')
      .selectAll('reviewAnchors')
      .select((eb) => this.withReview(eb))
      .where('reviewAnchors.pageId', '=', pageId)
      .orderBy('reviewAnchors.createdAt', 'asc')
      .execute();
  }

  async findByReviewId(reviewId: string): Promise<ReviewAnchor[]> {
    return this.db
      .selectFrom('reviewAnchors')
      .selectAll('reviewAnchors')
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('pages')
            .select(['pages.id', 'pages.title', 'pages.slugId', 'pages.spaceId'])
            .whereRef('pages.id', '=', 'reviewAnchors.pageId'),
        ).as('page'),
      )
      .where('reviewId', '=', reviewId)
      .orderBy('createdAt', 'asc')
      .execute();
  }

  async insertAnchor(
    data: InsertableReviewAnchor,
    trx?: KyselyTransaction,
  ): Promise<ReviewAnchor> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('reviewAnchors')
      .values(data)
      .returningAll()
      .executeTakeFirst();
  }

  async deleteAnchor(anchorId: string) {
    await this.db
      .deleteFrom('reviewAnchors')
      .where('id', '=', anchorId)
      .execute();
  }

  private withReview(eb: ExpressionBuilder<DB, 'reviewAnchors'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('reviews')
        .select([
          'reviews.id',
          'reviews.sequenceId',
          'reviews.title',
          'reviews.status',
          'reviews.content',
          'reviews.creatorId',
          'reviews.pageId',
          'reviews.spaceId',
        ])
        .whereRef('reviews.id', '=', 'reviewAnchors.reviewId')
        .where('reviews.deletedAt', 'is', null),
    ).as('review');
  }
}
