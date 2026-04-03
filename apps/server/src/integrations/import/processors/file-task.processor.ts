import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueJob, QueueName } from 'src/integrations/queue/constants';
import { FileImportTaskService } from '../services/file-import-task.service';
import { FileTaskStatus } from '../utils/file.utils';
import { StorageService } from '../../storage/storage.service';
import {
  InMemoryQueue,
  InMemoryJob,
  InjectQueue,
} from '../../queue/in-memory-queue';

@Injectable()
export class FileTaskProcessor implements OnModuleInit {
  private readonly logger = new Logger(FileTaskProcessor.name);

  constructor(
    private readonly fileTaskService: FileImportTaskService,
    private readonly storageService: StorageService,
    @InjectQueue(QueueName.FILE_TASK_QUEUE) private readonly queue: InMemoryQueue,
  ) {}

  onModuleInit() {
    this.queue.registerProcessor((job) => this.processJob(job));
  }

  private async processJob(job: InMemoryJob): Promise<void> {
    this.logger.debug(`Processing ${job.name} job`);
    try {
      await this.process(job);
      await this.onCompleted(job);
    } catch (err) {
      this.logger.error(
        `Error processing ${job.name} job. Import Task ID: ${job.data.fileTaskId}: ${err}`,
      );
      await this.handleFailedJob(job);
      throw err;
    }
  }

  private async process(job: InMemoryJob): Promise<void> {
    switch (job.name) {
      case QueueJob.IMPORT_TASK:
        await this.fileTaskService.processZIpImport(job.data.fileTaskId);
        break;
      case QueueJob.EXPORT_TASK:
        // TODO: export task
        break;
    }
  }

  private async onCompleted(job: InMemoryJob) {
    this.logger.log(
      `Completed ${job.name} job for File task ID ${job.data.fileTaskId}`,
    );

    try {
      const fileTask = await this.fileTaskService.getFileTask(
        job.data.fileTaskId,
      );
      if (fileTask) {
        await this.storageService.delete(fileTask.filePath);
        this.logger.debug(`Deleted imported zip file: ${fileTask.filePath}`);
      }
    } catch (err) {
      this.logger.error(`Failed to delete imported zip file:`, err);
    }
  }

  private async handleFailedJob(job: InMemoryJob) {
    try {
      const fileTaskId = job.data.fileTaskId;
      const reason = String(job.failedReason || 'Unknown error');

      await this.fileTaskService.updateTaskStatus(
        fileTaskId,
        FileTaskStatus.Failed,
        reason,
      );

      const fileTask = await this.fileTaskService.getFileTask(fileTaskId);
      if (fileTask) {
        await this.storageService.delete(fileTask.filePath);
      }
    } catch (err) {
      this.logger.error(err);
    }
  }
}
