import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import {
  IPageMentionNotificationJob,
  IPageUpdateNotificationJob,
  IPermissionGrantedNotificationJob,
  IReviewAssignedNotificationJob,
  IReviewCommentCreatedNotificationJob,
  IReviewStatusChangedNotificationJob,
} from '../../integrations/queue/constants/queue.interface';
import { PageNotificationService } from './services/page.notification';
import { ReviewNotificationService } from './services/review.notification';
import { DomainService } from '../../integrations/environment/domain.service';
import {
  InMemoryQueue,
  InMemoryJob,
  InjectQueue,
} from '../../integrations/queue/in-memory-queue';

@Injectable()
export class NotificationProcessor implements OnModuleInit {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly pageNotificationService: PageNotificationService,
    private readonly reviewNotificationService: ReviewNotificationService,
    private readonly domainService: DomainService,
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE) private readonly queue: InMemoryQueue,
  ) {}

  onModuleInit() {
    this.queue.registerProcessor((job) => this.process(job));
  }

  async process(
    job: InMemoryJob<
      | IPageMentionNotificationJob
      | IPageUpdateNotificationJob
      | IPermissionGrantedNotificationJob
      | IReviewAssignedNotificationJob
      | IReviewStatusChangedNotificationJob
      | IReviewCommentCreatedNotificationJob
    >,
  ): Promise<void> {
    try {
      const workspaceId = (job.data as { workspaceId: string }).workspaceId;
      const appUrl = await this.getWorkspaceUrl(workspaceId);

      switch (job.name) {
        case QueueJob.REVIEW_ASSIGNED: {
          await this.reviewNotificationService.processAssigned(
            job.data as IReviewAssignedNotificationJob,
          );
          break;
        }

        case QueueJob.REVIEW_STATUS_CHANGED: {
          await this.reviewNotificationService.processStatusChanged(
            job.data as IReviewStatusChangedNotificationJob,
          );
          break;
        }

        case QueueJob.REVIEW_COMMENT_CREATED: {
          await this.reviewNotificationService.processCommentCreated(
            job.data as IReviewCommentCreatedNotificationJob,
          );
          break;
        }

        case QueueJob.PAGE_MENTION_NOTIFICATION: {
          await this.pageNotificationService.processPageMention(
            job.data as IPageMentionNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.PAGE_PERMISSION_GRANTED: {
          await this.pageNotificationService.processPermissionGranted(
            job.data as IPermissionGrantedNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.PAGE_UPDATED: {
          await this.pageNotificationService.processPageUpdate(
            job.data as IPageUpdateNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.PAGE_UPDATE_DIGEST: {
          const { userId } = job.data as unknown as { userId: string };
          await this.pageNotificationService.processDigest(userId, appUrl);
          break;
        }

        default:
          this.logger.warn(`Unknown notification job: ${job.name}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to process ${job.name}: ${message}`);
      throw err;
    }
  }

  private async getWorkspaceUrl(workspaceId: string): Promise<string> {
    const workspace = await this.db
      .selectFrom('workspaces')
      .select('hostname')
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    return this.domainService.getUrl(workspace?.hostname);
  }
}
