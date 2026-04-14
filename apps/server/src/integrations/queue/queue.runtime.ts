import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import * as os from 'node:os';
import { sql } from 'kysely';
import * as postgres from 'postgres';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import { normalizePostgresUrl } from '../../common/helpers';
import {
  computeBackoffMs,
  DEFAULT_CONCURRENCY,
  EnqueueOptions,
  LISTEN_CHANNEL,
  QUEUE_CONCURRENCY,
  QUEUE_RUNTIME_CONFIG,
  resolveEnqueueOptions,
} from './queue.config';

export type { EnqueueOptions } from './queue.config';

export interface Job<T = any> {
  readonly id: string;
  readonly name: string;
  readonly data: T;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly queueName: string;
  /** Last error message, set on the previous failed attempt (if any). */
  readonly failedReason?: string;
}

export type JobProcessor = (job: Job) => Promise<void>;

type ClaimedRow = {
  id: string;
  queueName: string;
  jobName: string;
  data: any;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
};

/**
 * Process-wide runtime backing all JobQueue facades.
 * Runs one dispatch loop + N worker loops per registered queue.
 */
export class QueueRuntime {
  private readonly logger = new Logger('QueueRuntime');
  private readonly processors = new Map<string, JobProcessor>();
  private readonly wakeups = new EventEmitter();
  private listenClient?: ReturnType<typeof postgres>;
  private processId?: string;
  private heartbeatTimer?: NodeJS.Timeout;
  private dispatchTimer?: NodeJS.Timeout;
  private workerLoops: Promise<void>[] = [];
  private shuttingDown = false;
  private started = false;

  constructor(
    private readonly db: KyselyDB,
    private readonly databaseUrl: string,
  ) {
    this.wakeups.setMaxListeners(100);
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    this.processId = await this.registerProcess();
    this.heartbeatTimer = setInterval(
      () => this.heartbeat(),
      QUEUE_RUNTIME_CONFIG.heartbeatIntervalMs,
    );

    await this.startListener();

    this.dispatchTimer = setInterval(
      () => this.dispatchTick(),
      QUEUE_RUNTIME_CONFIG.dispatchIntervalMs,
    );
    // Kick one immediately so scheduled jobs pending from a prior run are promoted.
    void this.dispatchTick();

    // Spin up worker loops only for queues with a registered processor.
    // Queues without processors (e.g. search/ai/audit if their processors
    // aren't bundled in this build) are left alone — enqueued jobs just
    // sit in ready_executions until a processor ships.
    for (const queueName of this.processors.keys()) {
      const concurrency = QUEUE_CONCURRENCY[queueName] ?? DEFAULT_CONCURRENCY;
      for (let i = 0; i < concurrency; i++) {
        this.workerLoops.push(this.workerLoop(queueName, i));
      }
    }

    this.logger.log(
      `Queue runtime started (process ${this.processId}, ${this.workerLoops.length} workers)`,
    );
  }

  async stop(): Promise<void> {
    if (!this.started || this.shuttingDown) return;
    this.shuttingDown = true;
    this.logger.log('Queue runtime shutting down');

    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);

    // Wake up all workers so they observe shuttingDown and exit promptly.
    this.wakeups.emit('*');

    await Promise.allSettled(this.workerLoops);

    if (this.listenClient) {
      try {
        await this.listenClient.end({ timeout: 5 });
      } catch (err) {
        this.logger.warn(`Error closing listen client: ${err}`);
      }
    }

    if (this.processId) {
      try {
        await sql`DELETE FROM queue_processes WHERE id = ${this.processId}`.execute(
          this.db,
        );
      } catch (err) {
        this.logger.warn(`Error unregistering process: ${err}`);
      }
    }
  }

  registerProcessor(queueName: string, processor: JobProcessor): void {
    this.processors.set(queueName, processor);
  }

  async enqueue(
    queueName: string,
    jobName: string,
    data: any,
    opts: EnqueueOptions = {},
  ): Promise<{ id: string } | null> {
    const { delay, priority, maxAttempts, uniqueKey } =
      resolveEnqueueOptions(opts);

    return this.db.transaction().execute(async (trx) => {
      // Insert the canonical job row. If a unique_key collides with an active
      // job on this queue, do nothing (idempotent enqueue).
      // Pass the payload as a JS object. postgres.js auto-encodes it once for
      // the jsonb column, yielding jsonb_typeof='object'. Pre-serializing with
      // JSON.stringify here would double-encode as a jsonb scalar string and
      // break every consumer that destructures job.data.
      const inserted = await sql<{ id: string }>`
        INSERT INTO jobs (queue_name, job_name, data, priority, unique_key, max_attempts)
        VALUES (${queueName}, ${jobName}, ${data}, ${priority}, ${uniqueKey}, ${maxAttempts})
        ON CONFLICT (queue_name, unique_key)
          WHERE unique_key IS NOT NULL AND finished_at IS NULL
          DO NOTHING
        RETURNING id
      `.execute(trx);

      const row = inserted.rows[0];
      if (!row) return null;

      if (delay > 0) {
        const scheduledAt = new Date(Date.now() + delay);
        await sql`
          INSERT INTO scheduled_executions (job_id, queue_name, scheduled_at)
          VALUES (${row.id}, ${queueName}, ${scheduledAt})
        `.execute(trx);
      } else {
        // The ready_executions INSERT trigger fires pg_notify('jobs_ready', queue_name).
        await sql`
          INSERT INTO ready_executions (job_id, queue_name, priority)
          VALUES (${row.id}, ${queueName}, ${priority})
        `.execute(trx);
      }

      return { id: row.id };
    });
  }

  // -------------------- internal: process registration --------------------

  private async registerProcess(): Promise<string> {
    const res = await sql<{ id: string }>`
      INSERT INTO queue_processes (kind, hostname, pid)
      VALUES ('worker', ${os.hostname()}, ${process.pid})
      RETURNING id
    `.execute(this.db);
    return res.rows[0].id;
  }

  private async heartbeat(): Promise<void> {
    if (!this.processId || this.shuttingDown) return;
    try {
      await sql`
        UPDATE queue_processes SET last_heartbeat_at = now() WHERE id = ${this.processId}
      `.execute(this.db);
    } catch (err) {
      this.logger.warn(`Heartbeat failed: ${err}`);
    }
  }

  // -------------------- internal: LISTEN/NOTIFY --------------------

  private async startListener(): Promise<void> {
    this.listenClient = postgres(normalizePostgresUrl(this.databaseUrl), {
      max: 1,
      onnotice: () => {},
    });

    try {
      await this.listenClient.listen(LISTEN_CHANNEL, (payload) => {
        // payload is the queue_name from the trigger.
        this.wakeups.emit(payload || '*');
        this.wakeups.emit('*');
      });
      this.logger.log(`Listening on "${LISTEN_CHANNEL}" channel`);
    } catch (err) {
      this.logger.warn(
        `LISTEN setup failed, falling back to polling only: ${err}`,
      );
    }
  }

  private waitForWake(queueName: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.wakeups.off(queueName, finish);
        this.wakeups.off('*', finish);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      this.wakeups.once(queueName, finish);
      this.wakeups.once('*', finish);
    });
  }

  // -------------------- internal: dispatch --------------------

  private async dispatchTick(): Promise<void> {
    if (this.shuttingDown) return;
    try {
      await this.promoteScheduled();
      await this.reapStuckClaims();
      await this.purgeOldJobs();
    } catch (err) {
      this.logger.error(`Dispatch tick error: ${err}`);
    }
  }

  private async promoteScheduled(): Promise<void> {
    // Move any scheduled_executions whose scheduled_at has passed into ready_executions.
    // The ready_executions INSERT trigger will NOTIFY listening workers.
    await sql`
      WITH due AS (
        DELETE FROM scheduled_executions
        WHERE scheduled_at <= now()
        RETURNING job_id, queue_name
      )
      INSERT INTO ready_executions (job_id, queue_name, priority)
      SELECT due.job_id, due.queue_name, jobs.priority
      FROM due JOIN jobs ON jobs.id = due.job_id
    `.execute(this.db);
  }

  private async reapStuckClaims(): Promise<void> {
    const stuckCutoff = new Date(
      Date.now() - QUEUE_RUNTIME_CONFIG.stuckClaimMs,
    );
    const deadCutoff = new Date(
      Date.now() - QUEUE_RUNTIME_CONFIG.deadProcessMs,
    );
    // A claim is stuck if it has lived past stuckClaimMs, or if its owning
    // process has not heartbeat recently. Move it back to ready so another
    // worker can pick it up. attempts is NOT incremented here — the fail path
    // will bump it if the retry also dies.
    await sql`
      WITH stuck AS (
        DELETE FROM claimed_executions
        WHERE claimed_at < ${stuckCutoff}
           OR process_id IS NULL
           OR process_id NOT IN (
             SELECT id FROM queue_processes WHERE last_heartbeat_at > ${deadCutoff}
           )
        RETURNING job_id, queue_name
      )
      INSERT INTO ready_executions (job_id, queue_name, priority)
      SELECT stuck.job_id, stuck.queue_name, jobs.priority
      FROM stuck JOIN jobs ON jobs.id = stuck.job_id
    `.execute(this.db);

    // Also clean up process rows whose heartbeat is long gone.
    await sql`
      DELETE FROM queue_processes WHERE last_heartbeat_at < ${deadCutoff}
    `.execute(this.db);
  }

  private async purgeOldJobs(): Promise<void> {
    const cutoff = new Date(Date.now() - QUEUE_RUNTIME_CONFIG.retentionMs);
    await sql`
      DELETE FROM jobs WHERE finished_at IS NOT NULL AND finished_at < ${cutoff}
    `.execute(this.db);
  }

  // -------------------- internal: worker loop --------------------

  private async workerLoop(queueName: string, index: number): Promise<void> {
    this.logger.debug(`Worker started: ${queueName}#${index}`);
    while (!this.shuttingDown) {
      let claimed: ClaimedRow | null = null;
      try {
        claimed = await this.claimNext(queueName);
      } catch (err) {
        this.logger.error(`claimNext error on ${queueName}: ${err}`);
      }

      if (!claimed) {
        await this.waitForWake(queueName, QUEUE_RUNTIME_CONFIG.pollIntervalMs);
        continue;
      }

      const processor = this.processors.get(queueName);
      if (!processor) {
        // No processor registered — requeue with a small delay to avoid a tight loop.
        await this.requeueWithBackoff(claimed, 30_000, 'no processor registered');
        continue;
      }

      try {
        await processor({
          id: claimed.id,
          name: claimed.jobName,
          data: claimed.data,
          attempts: claimed.attempts,
          maxAttempts: claimed.maxAttempts,
          queueName: claimed.queueName,
          failedReason: claimed.lastError ?? undefined,
        });
        await this.completeJob(claimed.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Job ${claimed.jobName} (${claimed.id}) failed: ${message}`,
        );
        await this.failJob(claimed, message);
      }
    }
    this.logger.debug(`Worker stopped: ${queueName}#${index}`);
  }

  private async claimNext(queueName: string): Promise<ClaimedRow | null> {
    if (!this.processId) return null;
    // Atomically move the next ready row into claimed_executions.
    const result = await sql<ClaimedRow>`
      WITH picked AS (
        DELETE FROM ready_executions
        WHERE id = (
          SELECT id FROM ready_executions
          WHERE queue_name = ${queueName}
          ORDER BY priority ASC, id ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING job_id, queue_name
      ),
      claim AS (
        INSERT INTO claimed_executions (job_id, queue_name, process_id)
        SELECT job_id, queue_name, ${this.processId}::uuid FROM picked
        RETURNING job_id
      )
      SELECT
        jobs.id AS id,
        jobs.queue_name AS "queueName",
        jobs.job_name AS "jobName",
        jobs.data AS data,
        jobs.attempts AS attempts,
        jobs.max_attempts AS "maxAttempts",
        jobs.last_error AS "lastError"
      FROM claim JOIN jobs ON jobs.id = claim.job_id
    `.execute(this.db);

    return result.rows[0] ?? null;
  }

  private async completeJob(jobId: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await sql`DELETE FROM claimed_executions WHERE job_id = ${jobId}`.execute(
        trx,
      );
      await sql`UPDATE jobs SET finished_at = now(), updated_at = now() WHERE id = ${jobId}`.execute(
        trx,
      );
    });
  }

  private async failJob(claimed: ClaimedRow, error: string): Promise<void> {
    const nextAttempts = claimed.attempts + 1;
    const shouldRetry = nextAttempts < claimed.maxAttempts;

    await this.db.transaction().execute(async (trx) => {
      await sql`DELETE FROM claimed_executions WHERE job_id = ${claimed.id}`.execute(
        trx,
      );
      await sql`
        UPDATE jobs SET attempts = ${nextAttempts}, last_error = ${error}, updated_at = now()
        WHERE id = ${claimed.id}
      `.execute(trx);

      if (shouldRetry) {
        const scheduledAt = new Date(
          Date.now() + computeBackoffMs(nextAttempts),
        );
        await sql`
          INSERT INTO scheduled_executions (job_id, queue_name, scheduled_at)
          VALUES (${claimed.id}, ${claimed.queueName}, ${scheduledAt})
        `.execute(trx);
      } else {
        await sql`
          INSERT INTO failed_executions (job_id, queue_name, error)
          VALUES (${claimed.id}, ${claimed.queueName}, ${error})
        `.execute(trx);
        await sql`UPDATE jobs SET finished_at = now() WHERE id = ${claimed.id}`.execute(
          trx,
        );
      }
    });
  }

  private async requeueWithBackoff(
    claimed: ClaimedRow,
    delayMs: number,
    reason: string,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await sql`DELETE FROM claimed_executions WHERE job_id = ${claimed.id}`.execute(
        trx,
      );
      await sql`UPDATE jobs SET last_error = ${reason}, updated_at = now() WHERE id = ${claimed.id}`.execute(
        trx,
      );
      const scheduledAt = new Date(Date.now() + delayMs);
      await sql`
        INSERT INTO scheduled_executions (job_id, queue_name, scheduled_at)
        VALUES (${claimed.id}, ${claimed.queueName}, ${scheduledAt})
      `.execute(trx);
    });
  }
}
