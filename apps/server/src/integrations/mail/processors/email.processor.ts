import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueName } from '../../queue/constants';
import { MailService } from '../mail.service';
import { MailMessage } from '../interfaces/mail.message';
import { NotificationRepo } from '@manadocs/db/repos/notification/notification.repo';
import {
  InMemoryQueue,
  InMemoryJob,
  InjectQueue,
} from '../../queue/in-memory-queue';

@Injectable()
export class EmailProcessor implements OnModuleInit {
  private readonly logger = new Logger(EmailProcessor.name);
  constructor(
    private readonly mailService: MailService,
    private readonly notificationRepo: NotificationRepo,
    @InjectQueue(QueueName.EMAIL_QUEUE) private readonly queue: InMemoryQueue,
  ) {}

  onModuleInit() {
    this.queue.registerProcessor((job) => this.process(job));
  }

  async process(job: InMemoryJob<MailMessage>): Promise<void> {
    this.logger.debug(`Processing ${job.name} job`);
    try {
      await this.mailService.sendEmail(job.data);
    } catch (err) {
      this.logger.error(`Error processing ${job.name} job: ${err}`);
      throw err;
    }

    if (job.data.notificationId) {
      try {
        await this.notificationRepo.markAsEmailed(job.data.notificationId);
      } catch (err) {
        this.logger.warn(
          `Failed to mark notification ${job.data.notificationId} as emailed`,
        );
      }
    }
    this.logger.debug(`Completed ${job.name} job`);
  }
}
