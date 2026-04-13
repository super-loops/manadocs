import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  Review,
  InsertableReview,
  UpdatableReview,
} from '@manadocs/db/types/entity.types';
import { PaginationOptions } from '@manadocs/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@manadocs/db/pagination/cursor-pagination';
import { ExpressionBuilder, sql } from 'kysely';
import { DB } from '@manadocs/db/types/db';
import { jsonObjectFrom, jsonArrayFrom } from 'kysely/helpers/postgres';

@Injectable()
export class ReviewRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    reviewId: string,
    opts?: {
      includeCreator?: boolean;
      includeAssignees?: boolean;
      includeAnchors?: boolean;
    },
  ): Promise<Review> {
    return await this.db
      .selectFrom('reviews')
      .selectAll('reviews')
      .$if(opts?.includeCreator, (qb) =>
        qb.select((eb) => this.withCreator(eb)),
      )
      .$if(opts?.includeAssignees, (qb) =>
        qb.select((eb) => this.withAssignees(eb)),
      )
      .$if(opts?.includeAnchors, (qb) =>
        qb.select((eb) => this.withAnchors(eb)),
      )
      .where('reviews.id', '=', reviewId)
      .where('reviews.deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findByPageId(
    pageId: string,
    pagination: PaginationOptions,
    status?: string,
  ) {
    let query = this.db
      .selectFrom('reviews')
      .selectAll('reviews')
      .select((eb) => this.withCreator(eb))
      .select((eb) => this.withAssignees(eb))
      .select((eb) => this.withAnchorCount(eb))
      .where('reviews.pageId', '=', pageId)
      .where('reviews.deletedAt', 'is', null);

    if (status) {
      query = query.where('reviews.status', '=', status);
    }

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'reviews.updatedAt', direction: 'desc' },
        { expression: 'reviews.id', direction: 'desc' },
      ],
      parseCursor: (cursor) => ({
        updatedAt: new Date(cursor.updatedAt),
        id: cursor.id,
      }),
    });
  }

  async findAssignedToUser(
    userId: string,
    groupIds: string[],
    workspaceId: string,
    statuses: string[],
    pagination: PaginationOptions,
  ) {
    let query = this.db
      .selectFrom('reviews')
      .selectAll('reviews')
      .select((eb) => this.withCreator(eb))
      .select((eb) => this.withAssignees(eb))
      .where('reviews.workspaceId', '=', workspaceId)
      .where('reviews.deletedAt', 'is', null)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom('reviewAssignees as ra')
            .select(sql`1`.as('one'))
            .whereRef('ra.reviewId', '=', 'reviews.id')
            .where((eb2) => {
              const conditions = [eb2('ra.userId', '=', userId)];
              if (groupIds.length > 0) {
                conditions.push(eb2('ra.groupId', 'in', groupIds));
              }
              return eb2.or(conditions);
            }),
        ),
      );

    if (statuses.length > 0) {
      query = query.where('reviews.status', 'in', statuses);
    }

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'reviews.updatedAt', direction: 'desc' },
        { expression: 'reviews.id', direction: 'desc' },
      ],
      parseCursor: (cursor) => ({
        updatedAt: new Date(cursor.updatedAt),
        id: cursor.id,
      }),
    });
  }

  async insertReview(
    data: InsertableReview,
    trx?: KyselyTransaction,
  ): Promise<Review> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('reviews')
      .values(data)
      .returningAll()
      .executeTakeFirst();
  }

  async updateReview(
    data: UpdatableReview,
    reviewId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('reviews')
      .set(data)
      .where('id', '=', reviewId)
      .execute();
  }

  async deleteReview(reviewId: string) {
    await this.db
      .updateTable('reviews')
      .set({ deletedAt: new Date() })
      .where('id', '=', reviewId)
      .execute();
  }

  private withCreator(eb: ExpressionBuilder<DB, 'reviews'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'reviews.creatorId'),
    ).as('creator');
  }

  private withAssignees(eb: ExpressionBuilder<DB, 'reviews'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('reviewAssignees as ra')
        .select(['ra.id', 'ra.userId', 'ra.groupId', 'ra.createdAt'])
        .select((eb2) =>
          jsonObjectFrom(
            eb2
              .selectFrom('users')
              .select(['users.id', 'users.name', 'users.avatarUrl'])
              .whereRef('users.id', '=', 'ra.userId'),
          ).as('user'),
        )
        .select((eb2) =>
          jsonObjectFrom(
            eb2
              .selectFrom('groups')
              .select(['groups.id', 'groups.name'])
              .whereRef('groups.id', '=', 'ra.groupId'),
          ).as('group'),
        )
        .whereRef('ra.reviewId', '=', 'reviews.id'),
    ).as('assignees');
  }

  private withAnchors(eb: ExpressionBuilder<DB, 'reviews'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('reviewAnchors as ra')
        .select([
          'ra.id',
          'ra.sequenceId',
          'ra.pageId',
          'ra.createdAt',
        ])
        .select((eb2) =>
          jsonObjectFrom(
            eb2
              .selectFrom('pages')
              .select(['pages.id', 'pages.title', 'pages.slugId', 'pages.spaceId'])
              .whereRef('pages.id', '=', 'ra.pageId'),
          ).as('page'),
        )
        .whereRef('ra.reviewId', '=', 'reviews.id')
        .orderBy('ra.createdAt', 'asc'),
    ).as('anchors');
  }

  private withAnchorCount(eb: ExpressionBuilder<DB, 'reviews'>) {
    return eb
      .selectFrom('reviewAnchors')
      .select(sql<number>`count(*)::int`.as('count'))
      .whereRef('reviewAnchors.reviewId', '=', 'reviews.id')
      .as('anchorCount');
  }
}
