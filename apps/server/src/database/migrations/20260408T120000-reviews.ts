import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Sequences table for workspace-scoped sequential IDs
  await db.schema
    .createTable('sequences')
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('sequence_name', 'varchar', (col) => col.notNull())
    .addColumn('current_value', 'bigint', (col) => col.notNull().defaultTo(0))
    .addPrimaryKeyConstraint('sequences_pkey', [
      'workspace_id',
      'sequence_name',
    ])
    .execute();

  // Reviews table
  await db.schema
    .createTable('reviews')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('sequence_id', 'bigint', (col) => col.notNull())
    .addColumn('title', 'varchar')
    .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('open'))
    .addColumn('content', 'jsonb')
    .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade'),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('resolved_at', 'timestamptz')
    .addColumn('resolved_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz')
    .addUniqueConstraint('reviews_workspace_sequence_unique', [
      'workspace_id',
      'sequence_id',
    ])
    .execute();

  await db.schema
    .createIndex('idx_reviews_page_id')
    .on('reviews')
    .column('page_id')
    .execute();

  await db.schema
    .createIndex('idx_reviews_workspace_status')
    .on('reviews')
    .columns(['workspace_id', 'status'])
    .execute();

  // Review histories table (comments + status changes)
  await db.schema
    .createTable('review_histories')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('review_id', 'uuid', (col) =>
      col.references('reviews.id').onDelete('cascade').notNull(),
    )
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('content', 'jsonb')
    .addColumn('old_status', 'varchar')
    .addColumn('new_status', 'varchar')
    .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('edited_at', 'timestamptz')
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('idx_review_histories_review_id')
    .on('review_histories')
    .columns(['review_id', 'created_at'])
    .execute();

  // Review anchors table
  await db.schema
    .createTable('review_anchors')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('sequence_id', 'bigint', (col) => col.notNull())
    .addColumn('review_id', 'uuid', (col) =>
      col.references('reviews.id').onDelete('cascade').notNull(),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('review_anchors_workspace_sequence_unique', [
      'workspace_id',
      'sequence_id',
    ])
    .execute();

  await db.schema
    .createIndex('idx_review_anchors_page_id')
    .on('review_anchors')
    .column('page_id')
    .execute();

  await db.schema
    .createIndex('idx_review_anchors_review_id')
    .on('review_anchors')
    .column('review_id')
    .execute();

  // Review assignees table
  await db.schema
    .createTable('review_assignees')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('review_id', 'uuid', (col) =>
      col.references('reviews.id').onDelete('cascade').notNull(),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade'),
    )
    .addColumn('group_id', 'uuid', (col) =>
      col.references('groups.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_review_assignees_review_id')
    .on('review_assignees')
    .column('review_id')
    .execute();

  // Add check constraint: at least one of user_id or group_id must be set
  await sql`ALTER TABLE review_assignees ADD CONSTRAINT review_assignees_user_or_group_check CHECK (user_id IS NOT NULL OR group_id IS NOT NULL)`.execute(
    db,
  );

  // Unique constraints to prevent duplicate assignments
  await sql`CREATE UNIQUE INDEX idx_review_assignees_user_unique ON review_assignees (review_id, user_id) WHERE user_id IS NOT NULL`.execute(
    db,
  );
  await sql`CREATE UNIQUE INDEX idx_review_assignees_group_unique ON review_assignees (review_id, group_id) WHERE group_id IS NOT NULL`.execute(
    db,
  );

  // Add review_id column to notifications table
  await db.schema
    .alterTable('notifications')
    .addColumn('review_id', 'uuid', (col) =>
      col.references('reviews.id').onDelete('cascade'),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('notifications')
    .dropColumn('review_id')
    .execute();

  await db.schema.dropTable('review_assignees').execute();
  await db.schema.dropTable('review_anchors').execute();
  await db.schema.dropTable('review_histories').execute();
  await db.schema.dropTable('reviews').execute();
  await db.schema.dropTable('sequences').execute();
}
