import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue, InMemoryQueue } from '../../integrations/queue/in-memory-queue';
import { ReviewRepo } from '@manadocs/db/repos/review/review.repo';
import { ReviewHistoryRepo } from '@manadocs/db/repos/review/review-history.repo';
import { ReviewAnchorRepo } from '@manadocs/db/repos/review/review-anchor.repo';
import { ReviewAssigneeRepo } from '@manadocs/db/repos/review/review-assignee.repo';
import { SequenceRepo } from '@manadocs/db/repos/review/sequence.repo';
import { GroupUserRepo } from '@manadocs/db/repos/group/group-user.repo';
import { Page, User } from '@manadocs/db/types/entity.types';
import { PaginationOptions } from '@manadocs/db/pagination/pagination-options';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { WsService } from '../../ws/ws.service';
import {
  CreateReviewDto,
  ChangeReviewStatusDto,
  AddReviewCommentDto,
  CreateReviewAnchorDto,
  UpdateReviewAssigneesDto,
} from './dto/review.dto';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private reviewRepo: ReviewRepo,
    private reviewHistoryRepo: ReviewHistoryRepo,
    private reviewAnchorRepo: ReviewAnchorRepo,
    private reviewAssigneeRepo: ReviewAssigneeRepo,
    private sequenceRepo: SequenceRepo,
    private groupUserRepo: GroupUserRepo,
    private wsService: WsService,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private notificationQueue: InMemoryQueue,
  ) {}

  async findById(reviewId: string) {
    const review = await this.reviewRepo.findById(reviewId, {
      includeCreator: true,
      includeAssignees: true,
      includeAnchors: true,
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  async create(
    opts: { page: Page; workspaceId: string; user: User },
    dto: CreateReviewDto,
  ) {
    const { page, workspaceId, user } = opts;

    const sequenceId = await this.sequenceRepo.nextVal(
      workspaceId,
      'review',
    );

    const content = dto.content ? JSON.parse(dto.content) : null;

    const review = await this.reviewRepo.insertReview({
      sequenceId,
      title: dto.title,
      status: 'open',
      content,
      creatorId: user.id,
      pageId: page.id,
      spaceId: page.spaceId,
      workspaceId,
    });

    // Add initial comment to history if content provided
    if (content) {
      await this.reviewHistoryRepo.insertHistory({
        reviewId: review.id,
        type: 'comment',
        content,
        creatorId: user.id,
        workspaceId,
      });
    }

    // Set assignees
    const userIds = dto.assigneeUserIds ?? [];
    const groupIds = dto.assigneeGroupIds ?? [];
    if (userIds.length > 0 || groupIds.length > 0) {
      await this.reviewAssigneeRepo.setAssignees(
        review.id,
        userIds,
        groupIds,
      );
    }

    // Queue notifications for assignees
    if (userIds.length > 0 || groupIds.length > 0) {
      this.notificationQueue
        .add(QueueJob.REVIEW_ASSIGNED, {
          reviewId: review.id,
          pageId: page.id,
          spaceId: page.spaceId,
          workspaceId,
          actorId: user.id,
        })
        .catch((err) =>
          this.logger.warn(`Failed to queue review assigned notification: ${err.message}`),
        );
    }

    // Emit WebSocket event
    const fullReview = await this.findById(review.id);
    this.wsService
      .emitReviewEvent(page.spaceId, page.id, {
        operation: 'reviewCreated',
        pageId: page.id,
        review: fullReview,
      })
      .catch((err) =>
        this.logger.warn(`Failed to emit reviewCreated: ${err.message}`),
      );

    return fullReview;
  }

  async changeStatus(dto: ChangeReviewStatusDto, user: User) {
    const review = await this.reviewRepo.findById(dto.reviewId);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.status === dto.status) {
      throw new BadRequestException('Status is already ' + dto.status);
    }

    const oldStatus = review.status;

    const updateData: any = {
      status: dto.status,
      updatedAt: new Date(),
    };

    if (dto.status === 'resolved') {
      updateData.resolvedAt = new Date();
      updateData.resolvedById = user.id;
    } else if (oldStatus === 'resolved') {
      // Reopening
      updateData.resolvedAt = null;
      updateData.resolvedById = null;
    }

    await this.reviewRepo.updateReview(updateData, dto.reviewId);

    // Add status change to history
    await this.reviewHistoryRepo.insertHistory({
      reviewId: dto.reviewId,
      type: 'status',
      oldStatus,
      newStatus: dto.status,
      creatorId: user.id,
      workspaceId: review.workspaceId,
    });

    // Queue notification
    this.notificationQueue
      .add(QueueJob.REVIEW_STATUS_CHANGED, {
        reviewId: review.id,
        oldStatus,
        newStatus: dto.status,
        pageId: review.pageId,
        spaceId: review.spaceId,
        workspaceId: review.workspaceId,
        actorId: user.id,
      })
      .catch((err) =>
        this.logger.warn(`Failed to queue review status notification: ${err.message}`),
      );

    const updatedReview = await this.findById(dto.reviewId);

    this.wsService
      .emitReviewEvent(review.spaceId, review.pageId, {
        operation: 'reviewUpdated',
        pageId: review.pageId,
        review: updatedReview,
      })
      .catch((err) =>
        this.logger.warn(`Failed to emit reviewUpdated: ${err.message}`),
      );

    return updatedReview;
  }

  async addComment(dto: AddReviewCommentDto, user: User) {
    const review = await this.reviewRepo.findById(dto.reviewId);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const content = JSON.parse(dto.content);

    const history = await this.reviewHistoryRepo.insertHistory({
      reviewId: review.id,
      type: 'comment',
      content,
      creatorId: user.id,
      workspaceId: review.workspaceId,
    });

    // Update review's updatedAt
    await this.reviewRepo.updateReview(
      { updatedAt: new Date() },
      review.id,
    );

    // Queue notification
    this.notificationQueue
      .add(QueueJob.REVIEW_COMMENT_CREATED, {
        reviewId: review.id,
        historyId: history.id,
        pageId: review.pageId,
        spaceId: review.spaceId,
        workspaceId: review.workspaceId,
        actorId: user.id,
      })
      .catch((err) =>
        this.logger.warn(`Failed to queue review comment notification: ${err.message}`),
      );

    // Fetch with creator
    const histories = await this.reviewHistoryRepo.findByReviewId(review.id);
    const createdHistory = histories.find((h) => h.id === history.id);

    this.wsService
      .emitReviewEvent(review.spaceId, review.pageId, {
        operation: 'reviewCommentAdded',
        pageId: review.pageId,
        reviewId: review.id,
        history: createdHistory,
      })
      .catch((err) =>
        this.logger.warn(`Failed to emit reviewCommentAdded: ${err.message}`),
      );

    return createdHistory;
  }

  async createAnchor(dto: CreateReviewAnchorDto, user: User) {
    const review = await this.reviewRepo.findById(dto.reviewId);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const sequenceId = await this.sequenceRepo.nextVal(
      review.workspaceId,
      'review_anchor',
    );

    const anchor = await this.reviewAnchorRepo.insertAnchor({
      sequenceId,
      reviewId: review.id,
      pageId: dto.pageId,
      workspaceId: review.workspaceId,
      creatorId: user.id,
    });

    this.wsService
      .emitReviewEvent(review.spaceId, dto.pageId, {
        operation: 'reviewAnchorCreated',
        pageId: dto.pageId,
        anchor: {
          ...anchor,
          reviewSequenceId: review.sequenceId,
          reviewStatus: review.status,
        },
      })
      .catch((err) =>
        this.logger.warn(`Failed to emit reviewAnchorCreated: ${err.message}`),
      );

    return {
      ...anchor,
      reviewSequenceId: review.sequenceId,
      reviewStatus: review.status,
    };
  }

  async deleteAnchor(anchorId: string, user: User) {
    const anchor = await this.reviewAnchorRepo.findById(anchorId);
    if (!anchor) {
      throw new NotFoundException('Anchor not found');
    }

    const review = await this.reviewRepo.findById(anchor.reviewId);

    await this.reviewAnchorRepo.deleteAnchor(anchorId);

    if (review) {
      this.wsService
        .emitReviewEvent(review.spaceId, anchor.pageId, {
          operation: 'reviewAnchorDeleted',
          pageId: anchor.pageId,
          anchorId: anchor.id,
          reviewId: anchor.reviewId,
        })
        .catch((err) =>
          this.logger.warn(`Failed to emit reviewAnchorDeleted: ${err.message}`),
        );
    }
  }

  async updateAssignees(dto: UpdateReviewAssigneesDto, user: User) {
    const review = await this.reviewRepo.findById(dto.reviewId);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const userIds = dto.assigneeUserIds ?? [];
    const groupIds = dto.assigneeGroupIds ?? [];

    await this.reviewAssigneeRepo.setAssignees(
      review.id,
      userIds,
      groupIds,
    );

    await this.reviewRepo.updateReview(
      { updatedAt: new Date() },
      review.id,
    );

    // Queue notification for new assignees
    if (userIds.length > 0 || groupIds.length > 0) {
      this.notificationQueue
        .add(QueueJob.REVIEW_ASSIGNED, {
          reviewId: review.id,
          pageId: review.pageId,
          spaceId: review.spaceId,
          workspaceId: review.workspaceId,
          actorId: user.id,
        })
        .catch((err) =>
          this.logger.warn(`Failed to queue review assigned notification: ${err.message}`),
        );
    }

    const updatedReview = await this.findById(review.id);

    this.wsService
      .emitReviewEvent(review.spaceId, review.pageId, {
        operation: 'reviewUpdated',
        pageId: review.pageId,
        review: updatedReview,
      })
      .catch((err) =>
        this.logger.warn(`Failed to emit reviewUpdated: ${err.message}`),
      );

    return updatedReview;
  }

  async findByPageId(pageId: string, pagination: PaginationOptions, status?: string) {
    return this.reviewRepo.findByPageId(pageId, pagination, status);
  }

  async findHistoriesByReviewId(reviewId: string) {
    return this.reviewHistoryRepo.findByReviewId(reviewId);
  }

  async findAnchorsByPageId(pageId: string) {
    return this.reviewAnchorRepo.findByPageId(pageId);
  }

  async findAssignedToUser(
    user: User,
    statuses: string[],
    pagination: PaginationOptions,
  ) {
    const groupIds = await this.groupUserRepo.getUserGroupIds(user.id);

    return this.reviewRepo.findAssignedToUser(
      user.id,
      groupIds,
      user.workspaceId,
      statuses,
      pagination,
    );
  }

  async deleteReview(reviewId: string) {
    const review = await this.reviewRepo.findById(reviewId);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    await this.reviewRepo.deleteReview(reviewId);

    this.wsService
      .emitReviewEvent(review.spaceId, review.pageId, {
        operation: 'reviewDeleted',
        pageId: review.pageId,
        reviewId: review.id,
      })
      .catch((err) =>
        this.logger.warn(`Failed to emit reviewDeleted: ${err.message}`),
      );
  }
}
