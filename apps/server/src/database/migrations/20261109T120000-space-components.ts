import { type Kysely, sql } from 'kysely';

/**
 * 스페이스 컴포넌트 (PLAN-space-components).
 *
 * - component_collections: 컴포넌트 묶음 (사이드바 Components 아래 폴더)
 * - components: 스페이스 안에서 slug 가 고유한 에셋(이미지·파일). 리비전 0 = 에셋 없음
 * - component_revisions: 불변 리비전 체인. 첨부는 attachments(type='component', page_id NULL)
 * - component_upload_tickets: MCP 토큰 전용 1회용 업로드 티켓(10분)
 *
 * 사용처(어느 문서에 인스턴스가 있나)는 색인 테이블을 두지 않는다 — 작업문서·버전
 * 본문(JSON)에서 그때그때 찾는다. 색인은 Yjs 저장 경로 전부를 따라가야 맞게 유지되는데,
 * 그 경로가 여럿이라 어긋난 색인이 «없는 사용처»를 만드는 쪽이 더 위험하다.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('component_collections')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col)
    .addColumn('position', 'int4', (col) => col.notNull().defaultTo(0))
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .execute();

  await db.schema
    .createIndex('component_collections_space_id_idx')
    .on('component_collections')
    .column('space_id')
    .execute();

  await db.schema
    .createTable('components')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('collection_id', 'uuid', (col) =>
      col.references('component_collections.id').onDelete('restrict').notNull(),
    )
    .addColumn('slug', 'varchar', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col)
    .addColumn('kind', 'varchar', (col) => col.notNull().defaultTo('image'))
    .addColumn('current_revision', 'int4', (col) => col.notNull().defaultTo(0))
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('deleted_at', 'timestamptz', (col) => col)
    .execute();

  // slug 는 살아 있는 컴포넌트 사이에서만 고유 — 지운 slug 는 다시 쓸 수 있다
  await db.schema
    .createIndex('components_space_slug_live_unique')
    .on('components')
    .columns(['space_id', 'slug'])
    .unique()
    .where(sql.ref('deleted_at'), 'is', null)
    .execute();

  await db.schema
    .createIndex('components_collection_id_idx')
    .on('components')
    .column('collection_id')
    .execute();

  await db.schema
    .createTable('component_revisions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('component_id', 'uuid', (col) =>
      col.references('components.id').onDelete('cascade').notNull(),
    )
    .addColumn('revision', 'int4', (col) => col.notNull())
    .addColumn('attachment_id', 'uuid', (col) =>
      col.references('attachments.id').onDelete('set null'),
    )
    .addColumn('file_name', 'varchar', (col) => col.notNull())
    .addColumn('file_size', 'int8', (col) => col)
    .addColumn('mime_type', 'varchar', (col) => col)
    .addColumn('message', 'varchar', (col) => col)
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('component_revisions_component_revision_unique')
    .on('component_revisions')
    .columns(['component_id', 'revision'])
    .unique()
    .execute();

  await db.schema
    .createTable('component_upload_tickets')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('token', 'varchar', (col) => col.notNull().unique())
    .addColumn('component_id', 'uuid', (col) =>
      col.references('components.id').onDelete('cascade').notNull(),
    )
    .addColumn('api_token_id', 'uuid', (col) => col.notNull())
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('message', 'varchar', (col) => col)
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('consumed_at', 'timestamptz', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('component_upload_tickets').ifExists().execute();
  await db.schema.dropTable('component_revisions').ifExists().execute();
  await db.schema.dropTable('components').ifExists().execute();
  await db.schema.dropTable('component_collections').ifExists().execute();
}
