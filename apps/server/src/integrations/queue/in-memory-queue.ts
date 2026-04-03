import { Inject } from '@nestjs/common';
import type {
  EnqueueOptions,
  Job,
  JobProcessor,
  QueueRuntime,
} from './queue.runtime';

export function getQueueToken(name: string): string {
  return `QUEUE_${name}`;
}

export function InjectQueue(name: string): ParameterDecorator {
  return Inject(getQueueToken(name));
}

/**
 * Thin per-queue facade. All state is held by the shared QueueRuntime; this
 * class is just a convenience binding so callers can inject a named queue
 * and call add()/registerProcessor() without knowing about the runtime.
 */
export class JobQueue {
  constructor(
    public readonly name: string,
    private readonly runtime: QueueRuntime,
  ) {}

  async add(
    jobName: string,
    data: any,
    opts?: EnqueueOptions,
  ): Promise<{ id: string } | null> {
    return this.runtime.enqueue(this.name, jobName, data, opts);
  }

  registerProcessor(processor: JobProcessor): void {
    this.runtime.registerProcessor(this.name, processor);
  }
}

// Legacy aliases — all existing consumers import these names from this path.
export { JobQueue as InMemoryQueue };
export type { Job as InMemoryJob, JobProcessor } from './queue.runtime';
