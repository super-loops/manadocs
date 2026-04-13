// Rollback is not supported — comments data was migrated in 20260409 and is no
// longer recoverable. The down() function recreates an empty comments table and
// a nullable notifications.comment_id column for schema compatibility only.

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('comments').ifExists().cascade().execute();

  await db.schema
    .alterTable('notifications')
    .dropColumn('comment_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('comments')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('content', 'jsonb', (col) => col)
    .addColumn('selection', 'varchar', (col) => col)
    .addColumn('type', 'varchar', (col) => col)
    .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('parent_comment_id', 'uuid', (col) =>
      col.references('comments.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').notNull(),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade'),
    )
    .addColumn('last_edited_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('resolved_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('resolved_at', 'timestamptz', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('edited_at', 'timestamptz', (col) => col)
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .execute();

  await db.schema
    .alterTable('notifications')
    .addColumn('comment_id', 'uuid')
    .execute();
}
