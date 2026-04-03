import {
  Global,
  Injectable,
  Logger,
  Module,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import { EnvironmentService } from '../environment/environment.service';
import { QueueName } from './constants';
import { GeneralQueueProcessor } from './processors/general-queue.processor';
import { JobQueue, getQueueToken } from './in-memory-queue';
import { QueueRuntime } from './queue.runtime';

/**
 * Owns the shared QueueRuntime instance and drives its lifecycle.
 * All per-queue JobQueue facades inject this to reach the runtime.
 */
@Injectable()
export class QueueRuntimeProvider
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger('QueueRuntimeProvider');
  readonly runtime: QueueRuntime;

  constructor(
    @InjectKysely() db: KyselyDB,
    env: EnvironmentService,
  ) {
    this.runtime = new QueueRuntime(db, env.getDatabaseURL());
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.runtime.start();
    } catch (err) {
      this.logger.error(`Failed to start queue runtime: ${err}`);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.runtime.stop();
  }
}

const queueNames = Object.values(QueueName);

const queueProviders = queueNames.map((name) => ({
  provide: getQueueToken(name),
  inject: [QueueRuntimeProvider],
  useFactory: (host: QueueRuntimeProvider) => new JobQueue(name, host.runtime),
}));

@Global()
@Module({
  providers: [QueueRuntimeProvider, ...queueProviders, GeneralQueueProcessor],
  exports: queueProviders.map((p) => p.provide),
})
export class QueueModule {}
