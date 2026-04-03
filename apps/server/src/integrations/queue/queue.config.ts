import { QueueName } from './constants';

/**
 * Per-queue concurrency (how many jobs from a queue may run simultaneously).
 * Each queue runs its own worker loop; total concurrent workers = sum below.
 */
export const QUEUE_CONCURRENCY: Record<string, number> = {
  [QueueName.EMAIL_QUEUE]: 5,
  [QueueName.NOTIFICATION_QUEUE]: 5,
  [QueueName.GENERAL_QUEUE]: 3,
  [QueueName.ATTACHMENT_QUEUE]: 2,
  [QueueName.HISTORY_QUEUE]: 2,
  [QueueName.FILE_TASK_QUEUE]: 1,
  [QueueName.BILLING_QUEUE]: 2,
  [QueueName.SEARCH_QUEUE]: 3,
  [QueueName.AI_QUEUE]: 2,
  [QueueName.AUDIT_QUEUE]: 2,
};

export const DEFAULT_CONCURRENCY = 1;

export const QUEUE_RUNTIME_CONFIG = {
  /** Base polling interval (ms) — fallback when LISTEN/NOTIFY is quiet. */
  pollIntervalMs: 2000,
  /** Dispatcher sweep interval (ms) — promotes scheduled jobs & reaps stuck claims. */
  dispatchIntervalMs: 2000,
  /** Heartbeat interval (ms) for this process. */
  heartbeatIntervalMs: 15_000,
  /** A claimed job is considered stuck after this many ms with no completion. */
  stuckClaimMs: 5 * 60_000,
  /** A process is considered dead after this many ms without heartbeat. */
  deadProcessMs: 60_000,
  /** Completed/failed jobs are purged after this many ms. */
  retentionMs: 14 * 24 * 60 * 60_000,
  /** Exponential backoff base (ms) for retries: base * 2^attempts. */
  backoffBaseMs: 10_000,
  /** Default maximum attempts if caller does not specify. */
  defaultMaxAttempts: 5,
};

export const LISTEN_CHANNEL = 'jobs_ready';

export interface EnqueueOptions {
  /** Idempotency key. If an active job (scheduled/ready/claimed) with the same
   *  unique_key already exists on this queue, the new enqueue is a no-op. */
  jobId?: string;
  /** Delay in milliseconds before the job becomes eligible to run. */
  delay?: number;
  /** Lower number = higher priority. Default 0. */
  priority?: number;
  /** Override default max attempts. */
  maxAttempts?: number;
  /** BullMQ-compatible alias for maxAttempts. */
  attempts?: number;
  /** BullMQ compatibility — ignored. Retention is governed by QueueRuntime config. */
  removeOnComplete?: boolean | number | { age?: number; count?: number };
  /** BullMQ compatibility — ignored. Failed jobs are retained until purge. */
  removeOnFail?: boolean | number | { age?: number; count?: number };
  /** BullMQ compatibility — ignored (fixed exponential backoff applied). */
  backoff?: any;
  /** BullMQ-style dedup. `deduplication.id` is used as the unique_key fallback. */
  deduplication?: { id: string };
}

/** Resolve caller-facing enqueue options into the runtime's internal fields. */
export function resolveEnqueueOptions(opts: EnqueueOptions): {
  delay: number;
  priority: number;
  maxAttempts: number;
  uniqueKey: string | null;
} {
  return {
    delay: Math.max(0, opts.delay ?? 0),
    priority: opts.priority ?? 0,
    maxAttempts:
      opts.maxAttempts ??
      opts.attempts ??
      QUEUE_RUNTIME_CONFIG.defaultMaxAttempts,
    uniqueKey: opts.jobId ?? opts.deduplication?.id ?? null,
  };
}

/** Backoff delay in ms for a given attempt number (1-indexed). */
export function computeBackoffMs(attempt: number): number {
  return QUEUE_RUNTIME_CONFIG.backoffBaseMs * Math.pow(2, attempt - 1);
}
