import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import { sql } from 'kysely';

@Injectable()
export class ReviewAssigneeRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async setAssignees(
    reviewId: string,
    userIds: string[],
    groupIds: string[],
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);

    // Remove existing assignees
    await db
      .deleteFrom('reviewAssignees')
      .where('reviewId', '=', reviewId)
      .execute();

    // Insert new assignees
    const values = [
      ...userIds.map((userId) => ({
        reviewId,
        userId,
        groupId: null as string | null,
      })),
      ...groupIds.map((groupId) => ({
        reviewId,
        userId: null as string | null,
        groupId,
      })),
    ];

    if (values.length > 0) {
      await db.insertInto('reviewAssignees').values(values).execute();
    }
  }

  async getAssigneeUserIds(reviewId: string): Promise<string[]> {
    // Direct user assignees
    const directUsers = await this.db
      .selectFrom('reviewAssignees')
      .select('userId')
      .where('reviewId', '=', reviewId)
      .where('userId', 'is not', null)
      .execute();

    // Users from assigned groups
    const groupUsers = await this.db
      .selectFrom('reviewAssignees as ra')
      .innerJoin('groupUsers as gu', 'gu.groupId', 'ra.groupId')
      .select('gu.userId')
      .where('ra.reviewId', '=', reviewId)
      .where('ra.groupId', 'is not', null)
      .execute();

    const userIdSet = new Set<string>();
    for (const row of directUsers) {
      if (row.userId) userIdSet.add(row.userId);
    }
    for (const row of groupUsers) {
      userIdSet.add(row.userId);
    }

    return Array.from(userIdSet);
  }
}
