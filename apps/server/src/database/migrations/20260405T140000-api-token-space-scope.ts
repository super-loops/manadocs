import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add explicit scope flag: 'all' | 'selected'
  await db.schema
    .alterTable('api_tokens')
    .addColumn('space_scope', 'varchar', (col) =>
      col.notNull().defaultTo('all'),
    )
    .execute();

  // Join table — cascades on both sides ensure automatic GC
  await db.schema
    .createTable('api_token_spaces')
    .addColumn('api_token_id', 'uuid', (col) =>
      col.notNull().references('api_tokens.id').onDelete('cascade'),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.notNull().references('spaces.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint('pk_api_token_spaces', [
      'api_token_id',
      'space_id',
    ])
    .execute();

  await db.schema
    .createIndex('idx_api_token_spaces_space_id')
    .on('api_token_spaces')
    .column('space_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_api_token_spaces_space_id').ifExists().execute();
  await db.schema.dropTable('api_token_spaces').ifExists().execute();
  await db.schema
    .alterTable('api_tokens')
    .dropColumn('space_scope')
    .execute();
}
