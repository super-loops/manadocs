import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueJob, QueueName } from '../constants';
import {
  IAddPageWatchersJob,
  IPageBacklinkJob,
} from '../constants/queue.interface';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import { BacklinkRepo } from '@manadocs/db/repos/backlink/backlink.repo';
import {
  WatcherRepo,
  WatcherType,
} from '@manadocs/db/repos/watcher/watcher.repo';
import { InsertableWatcher } from '@manadocs/db/types/entity.types';
import { processBacklinks } from '../tasks/backlinks.task';
import {
  InMemoryQueue,
  InMemoryJob,
  InjectQueue,
} from '../in-memory-queue';

@Injectable()
export class GeneralQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(GeneralQueueProcessor.name);
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly backlinkRepo: BacklinkRepo,
    private readonly watcherRepo: WatcherRepo,
    @InjectQueue(QueueName.GENERAL_QUEUE) private readonly queue: InMemoryQueue,
  ) {}

  onModuleInit() {
    this.queue.registerProcessor((job) => this.process(job));
  }

  async process(job: InMemoryJob): Promise<void> {
    this.logger.debug(`Processing ${job.name} job`);
    try {
      switch (job.name) {
        case QueueJob.ADD_PAGE_WATCHERS: {
          const { userIds, pageId, spaceId, workspaceId } =
            job.data as IAddPageWatchersJob;
          const watchers: InsertableWatcher[] = userIds.map((userId) => ({
            userId,
            pageId,
            spaceId,
            workspaceId,
            type: WatcherType.PAGE,
            addedById: userId,
          }));
          await this.watcherRepo.insertMany(watchers);
          break;
        }

        case QueueJob.PAGE_BACKLINKS: {
          await processBacklinks(
            this.db,
            this.backlinkRepo,
            job.data as IPageBacklinkJob,
          );
          break;
        }
      }
      this.logger.debug(`Completed ${job.name} job`);
    } catch (err) {
      this.logger.error(`Error processing ${job.name} job: ${err}`);
      throw err;
    }
  }
}
