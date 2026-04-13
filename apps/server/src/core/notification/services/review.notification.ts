import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import {
  IReviewAssignedNotificationJob,
  IReviewCommentCreatedNotificationJob,
  IReviewStatusChangedNotificationJob,
} from '../../../integrations/queue/constants/queue.interface';
import { NotificationService } from '../notification.service';
import { NotificationType } from '../notification.constants';
import { ReviewRepo } from '@manadocs/db/repos/review/review.repo';
import { ReviewHistoryRepo } from '@manadocs/db/repos/review/review-history.repo';
import { ReviewAssigneeRepo } from '@manadocs/db/repos/review/review-assignee.repo';
import { SpaceMemberRepo } from '@manadocs/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@manadocs/db/repos/page/page-permission.repo';

@Injectable()
export class ReviewNotificationService {
  private readonly logger = new Logger(ReviewNotificationService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly notificationService: NotificationService,
    private readonly reviewRepo: ReviewRepo,
    private readonly reviewHistoryRepo: ReviewHistoryRepo,
    private readonly reviewAssigneeRepo: ReviewAssigneeRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
  ) {}

  async processAssigned(data: IReviewAssignedNotificationJob) {
    const { reviewId, pageId, spaceId, workspaceId, actorId } = data;

    const review = await this.reviewRepo.findById(reviewId);
    if (!review) return;

    const assigneeIds = await this.reviewAssigneeRepo.getAssigneeUserIds(
      reviewId,
    );

    const recipientIds = await this.filterAccessibleRecipients(
      assigneeIds,
      actorId,
      spaceId,
      pageId,
    );

    for (const userId of recipientIds) {
      await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.REVIEW_ASSIGNED,
        actorId,
        pageId,
        spaceId,
        reviewId,
      });
    }
  }

  async processStatusChanged(data: IReviewStatusChangedNotificationJob) {
    const {
      reviewId,
      oldStatus,
      newStatus,
      pageId,
      spaceId,
      workspaceId,
      actorId,
    } = data;

    const review = await this.reviewRepo.findById(reviewId);
    if (!review) return;

    const assigneeIds = await this.reviewAssigneeRepo.getAssigneeUserIds(
      reviewId,
    );

    const candidateIds = [...new Set([review.creatorId, ...assigneeIds])];

    const recipientIds = await this.filterAccessibleRecipients(
      candidateIds,
      actorId,
      spaceId,
      pageId,
    );

    for (const userId of recipientIds) {
      await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.REVIEW_STATUS_CHANGED,
        actorId,
        pageId,
        spaceId,
        reviewId,
        data: { oldStatus, newStatus },
      });
    }
  }

  async processCommentCreated(data: IReviewCommentCreatedNotificationJob) {
    const { reviewId, historyId, pageId, spaceId, workspaceId, actorId } = data;

    const review = await this.reviewRepo.findById(reviewId);
    if (!review) return;

    const [assigneeIds, participantIds] = await Promise.all([
      this.reviewAssigneeRepo.getAssigneeUserIds(reviewId),
      this.getThreadParticipantIds(reviewId),
    ]);

    const candidateIds = [
      ...new Set([review.creatorId, ...assigneeIds, ...participantIds]),
    ];

    const recipientIds = await this.filterAccessibleRecipients(
      candidateIds,
      actorId,
      spaceId,
      pageId,
    );

    for (const userId of recipientIds) {
      await this.notificationService.create({
        userId,
        workspaceId,
        type: NotificationType.REVIEW_COMMENT_CREATED,
        actorId,
        pageId,
        spaceId,
        reviewId,
        data: { historyId },
      });
    }
  }

  private async getThreadParticipantIds(reviewId: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom('reviewHistories')
      .select('creatorId')
      .where('reviewId', '=', reviewId)
      .where('deletedAt', 'is', null)
      .execute();

    return [...new Set(rows.map((r) => r.creatorId))];
  }

  private async filterAccessibleRecipients(
    userIds: string[],
    actorId: string,
    spaceId: string,
    pageId: string,
  ): Promise<string[]> {
    const unique = [...new Set(userIds)].filter((id) => id && id !== actorId);
    if (unique.length === 0) return [];

    const usersWithSpaceAccess =
      await this.spaceMemberRepo.getUserIdsWithSpaceAccess(unique, spaceId);

    const usersWithPageAccess =
      await this.pagePermissionRepo.getUserIdsWithPageAccess(pageId, [
        ...usersWithSpaceAccess,
      ]);

    return usersWithPageAccess;
  }
}
