import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import {
  ICommentNotificationJob,
  ICommentResolvedNotificationJob,
  IPageMentionNotificationJob,
  IPageUpdateNotificationJob,
  IPermissionGrantedNotificationJob,
} from '../../integrations/queue/constants/queue.interface';
import { CommentNotificationService } from './services/comment.notification';
import { PageNotificationService } from './services/page.notification';
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
    private readonly commentNotificationService: CommentNotificationService,
    private readonly pageNotificationService: PageNotificationService,
    private readonly domainService: DomainService,
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE) private readonly queue: InMemoryQueue,
  ) {}

  onModuleInit() {
    this.queue.registerProcessor((job) => this.process(job));
  }

  async process(
    job: InMemoryJob<
      | ICommentNotificationJob
      | ICommentResolvedNotificationJob
      | IPageMentionNotificationJob
      | IPageUpdateNotificationJob
      | IPermissionGrantedNotificationJob
    >,
  ): Promise<void> {
    try {
      const workspaceId = (job.data as { workspaceId: string }).workspaceId;
      const appUrl = await this.getWorkspaceUrl(workspaceId);

      switch (job.name) {
        case QueueJob.COMMENT_NOTIFICATION: {
          await this.commentNotificationService.processComment(
            job.data as ICommentNotificationJob,
            appUrl,
          );
          break;
        }

        case QueueJob.COMMENT_RESOLVED_NOTIFICATION: {
          await this.commentNotificationService.processResolved(
            job.data as ICommentResolvedNotificationJob,
            appUrl,
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
