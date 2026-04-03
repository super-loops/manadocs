import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('api_tokens')
    .addColumn('token_type', 'varchar', (col) =>
      col.notNull().defaultTo('api'),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('api_tokens')
    .dropColumn('token_type')
    .execute();
}
