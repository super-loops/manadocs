import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Canonical job record. Lives until 14 days after finished_at (cleaned up by worker).
  await db.schema
    .createTable('jobs')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('queue_name', 'varchar', (col) => col.notNull())
    .addColumn('job_name', 'varchar', (col) => col.notNull())
    .addColumn('data', 'jsonb', (col) => col.notNull())
    .addColumn('priority', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('unique_key', 'varchar')
    .addColumn('attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('max_attempts', 'integer', (col) => col.notNull().defaultTo(5))
    .addColumn('last_error', 'text')
    .addColumn('finished_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Partial unique index: enforce BullMQ-style jobId dedup only among active jobs.
  await sql`
    CREATE UNIQUE INDEX jobs_active_unique_key_idx
      ON jobs (queue_name, unique_key)
      WHERE unique_key IS NOT NULL AND finished_at IS NULL
  `.execute(db);

  // Index for cleanup sweeps.
  await sql`
    CREATE INDEX jobs_finished_at_idx
      ON jobs (finished_at)
      WHERE finished_at IS NOT NULL
  `.execute(db);

  // Worker/dispatcher process heartbeats. Dead processes (stale heartbeat) have their
  // claims reaped by the dispatcher loop.
  await db.schema
    .createTable('queue_processes')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('kind', 'varchar', (col) => col.notNull())
    .addColumn('hostname', 'varchar', (col) => col.notNull())
    .addColumn('pid', 'integer', (col) => col.notNull())
    .addColumn('last_heartbeat_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await sql`
    CREATE INDEX queue_processes_heartbeat_idx
      ON queue_processes (last_heartbeat_at)
  `.execute(db);

  // Hot pointer tables. Rows move between them as the job state machine advances.

  // ready_executions: job is eligible to run right now.
  await db.schema
    .createTable('ready_executions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('job_id', 'uuid', (col) =>
      col.notNull().unique().references('jobs.id').onDelete('cascade'),
    )
    .addColumn('queue_name', 'varchar', (col) => col.notNull())
    .addColumn('priority', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Claim ordering index: lower priority first, then FIFO by id (uuid v7 is time-ordered).
  await sql`
    CREATE INDEX ready_executions_claim_idx
      ON ready_executions (queue_name, priority, id)
  `.execute(db);

  // claimed_executions: job is currently being worked on.
  await db.schema
    .createTable('claimed_executions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('job_id', 'uuid', (col) =>
      col.notNull().unique().references('jobs.id').onDelete('cascade'),
    )
    .addColumn('queue_name', 'varchar', (col) => col.notNull())
    .addColumn('process_id', 'uuid', (col) =>
      col.references('queue_processes.id').onDelete('set null'),
    )
    .addColumn('claimed_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await sql`
    CREATE INDEX claimed_executions_claimed_at_idx
      ON claimed_executions (claimed_at)
  `.execute(db);

  // scheduled_executions: job is scheduled to run in the future (delay, backoff).
  await db.schema
    .createTable('scheduled_executions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('job_id', 'uuid', (col) =>
      col.notNull().unique().references('jobs.id').onDelete('cascade'),
    )
    .addColumn('queue_name', 'varchar', (col) => col.notNull())
    .addColumn('scheduled_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await sql`
    CREATE INDEX scheduled_executions_due_idx
      ON scheduled_executions (scheduled_at)
  `.execute(db);

  // failed_executions: terminal failure. Retained for ops visibility until job
  // cleanup (14 days after finished_at).
  await db.schema
    .createTable('failed_executions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('job_id', 'uuid', (col) =>
      col.notNull().unique().references('jobs.id').onDelete('cascade'),
    )
    .addColumn('queue_name', 'varchar', (col) => col.notNull())
    .addColumn('error', 'text')
    .addColumn('failed_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Trigger: whenever a row lands in ready_executions, notify workers so they can
  // claim without waiting for the polling interval.
  await sql`
    CREATE OR REPLACE FUNCTION notify_ready_execution() RETURNS trigger AS $$
    BEGIN
      PERFORM pg_notify('jobs_ready', NEW.queue_name);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);

  await sql`
    CREATE TRIGGER ready_executions_notify_trigger
      AFTER INSERT ON ready_executions
      FOR EACH ROW EXECUTE FUNCTION notify_ready_execution()
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS ready_executions_notify_trigger ON ready_executions`.execute(
    db,
  );
  await sql`DROP FUNCTION IF EXISTS notify_ready_execution()`.execute(db);
  await db.schema.dropTable('failed_executions').execute();
  await db.schema.dropTable('scheduled_executions').execute();
  await db.schema.dropTable('claimed_executions').execute();
  await db.schema.dropTable('ready_executions').execute();
  await db.schema.dropTable('queue_processes').execute();
  await db.schema.dropTable('jobs').execute();
}
