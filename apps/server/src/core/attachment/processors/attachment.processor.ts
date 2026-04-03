import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AttachmentService } from '../services/attachment.service';
import { QueueJob, QueueName } from 'src/integrations/queue/constants';
import { ModuleRef } from '@nestjs/core';
import {
  InMemoryQueue,
  InMemoryJob,
  InjectQueue,
} from 'src/integrations/queue/in-memory-queue';

@Injectable()
export class AttachmentProcessor implements OnModuleInit {
  private readonly logger = new Logger(AttachmentProcessor.name);
  constructor(
    private readonly attachmentService: AttachmentService,
    private moduleRef: ModuleRef,
    @InjectQueue(QueueName.ATTACHMENT_QUEUE) private readonly queue: InMemoryQueue,
  ) {}

  onModuleInit() {
    this.queue.registerProcessor((job) => this.process(job));
  }

  async process(job: InMemoryJob): Promise<void> {
    this.logger.debug(`Processing ${job.name} job`);
    try {
      if (job.name === QueueJob.DELETE_SPACE_ATTACHMENTS) {
        await this.attachmentService.handleDeleteSpaceAttachments(job.data.id);
      }
      if (job.name === QueueJob.DELETE_USER_AVATARS) {
        await this.attachmentService.handleDeleteUserAvatars(job.data.id);
      }
      if (job.name === QueueJob.DELETE_PAGE_ATTACHMENTS) {
        await this.attachmentService.handleDeletePageAttachments(
          job.data.pageId,
        );
      }
      if (
        job.name === QueueJob.ATTACHMENT_INDEX_CONTENT ||
        job.name === QueueJob.ATTACHMENT_INDEXING
      ) {
        let AttachmentEeModule: any;
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          AttachmentEeModule = require('./../../../ee/attachments-ee/attachment-ee.service');
        } catch (err) {
          this.logger.debug(
            'Attachment enterprise module requested but EE module not bundled in this build',
          );
          return;
        }
        const attachmentEeService = this.moduleRef.get(
          AttachmentEeModule.AttachmentEeService,
          { strict: false },
        );

        if (job.name === QueueJob.ATTACHMENT_INDEX_CONTENT) {
          await attachmentEeService.indexAttachment(job.data.attachmentId);
        } else if (job.name === QueueJob.ATTACHMENT_INDEXING) {
          await attachmentEeService.indexAttachments(
            job.data.workspaceId,
          );
        }
      }
      this.logger.debug(`Completed ${job.name} job`);
    } catch (err) {
      this.logger.error(`Error processing ${job.name} job: ${err}`);
      throw err;
    }
  }
}
