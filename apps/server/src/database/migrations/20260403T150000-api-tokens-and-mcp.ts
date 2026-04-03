import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create api_tokens table
  await db.schema
    .createTable('api_tokens')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('token_hash', 'varchar', (col) => col.notNull().unique())
    .addColumn('token_prefix', 'varchar', (col) => col.notNull())
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('permissions', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('last_used_at', 'timestamptz')
    .addColumn('expires_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Create index for token_hash lookups
  await db.schema
    .createIndex('idx_api_tokens_token_hash')
    .on('api_tokens')
    .column('token_hash')
    .execute();

  // Create index for user lookups
  await db.schema
    .createIndex('idx_api_tokens_user_workspace')
    .on('api_tokens')
    .columns(['user_id', 'workspace_id'])
    .execute();

  // Add mcp_enabled column to workspaces
  await db.schema
    .alterTable('workspaces')
    .addColumn('mcp_enabled', 'boolean', (col) => col.defaultTo(false))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('workspaces').dropColumn('mcp_enabled').execute();

  await db.schema.dropIndex('idx_api_tokens_user_workspace').ifExists().execute();
  await db.schema.dropIndex('idx_api_tokens_token_hash').ifExists().execute();

  await db.schema.dropTable('api_tokens').execute();
}
