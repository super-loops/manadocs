import { type Kysely, sql } from 'kysely';

/**
 * 문서 형상관리 (PLAN-enhancement-202605-01) — Phase 1 스키마 + 데이터 마이그레이션.
 *
 * - page_versions: 명시적 확정(commit) 버전 스냅샷 체인
 * - page_working_docs: 작업문서(다중 가능, 그중 하나가 Primary)
 * - pages: primary_version_id / primary_working_doc_id / committed 검색 미러
 * - reviews.version_id: 리뷰의 버전 귀속
 * - shares: version_mode('primary'|'fixed') + fixed_version_id + on_discard('fallback'|'404')
 *
 * 데이터 마이그레이션(D1): 모든 기존 페이지(휴지통 포함)에 대해
 *   버전 0(생성 마커) + 버전 1(현재 본문 자동 확정, Primary) + Primary 작업문서 1개.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // 1. page_versions — working_doc_id FK 는 순환 참조라 테이블 생성 후 별도 추가
  await db.schema
    .createTable('page_versions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('version', 'int4', (col) => col.notNull())
    .addColumn('title', 'varchar', (col) => col)
    .addColumn('icon', 'varchar', (col) => col)
    .addColumn('cover_photo', 'varchar', (col) => col)
    .addColumn('content', 'jsonb', (col) => col)
    .addColumn('message', 'varchar', (col) => col)
    .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('contributor_ids', sql`uuid[]`, (col) => col.defaultTo('{}'))
    .addColumn('working_doc_id', 'uuid', (col) => col)
    .addColumn('discarded_at', 'timestamptz', (col) => col)
    .addColumn('discarded_by_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('page_versions_page_id_version_unique')
    .on('page_versions')
    .columns(['page_id', 'version'])
    .unique()
    .execute();

  // 2. page_working_docs
  await db.schema
    .createTable('page_working_docs')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('name', 'varchar', (col) => col)
    .addColumn('base_version_id', 'uuid', (col) =>
      col.references('page_versions.id').onDelete('set null'),
    )
    .addColumn('content', 'jsonb', (col) => col)
    .addColumn('ydoc', 'bytea', (col) => col)
    .addColumn('text_content', 'text', (col) => col)
    .addColumn('creator_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('contributor_ids', sql`uuid[]`, (col) => col.defaultTo('{}'))
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('page_working_docs_page_id_idx')
    .on('page_working_docs')
    .column('page_id')
    .execute();

  // 순환 FK: page_versions.working_doc_id → page_working_docs.id
  await db.schema
    .alterTable('page_versions')
    .addForeignKeyConstraint(
      'page_versions_working_doc_id_fk',
      ['working_doc_id'],
      'page_working_docs',
      ['id'],
      (cb) => cb.onDelete('set null'),
    )
    .execute();

  // 3. pages 확장
  await db.schema
    .alterTable('pages')
    .addColumn('primary_version_id', 'uuid', (col) =>
      col.references('page_versions.id').onDelete('set null'),
    )
    .addColumn('primary_working_doc_id', 'uuid', (col) =>
      col.references('page_working_docs.id').onDelete('set null'),
    )
    .addColumn('committed_text_content', 'text', (col) => col)
    .addColumn('committed_tsv', sql`tsvector`, (col) => col)
    .execute();

  await db.schema
    .createIndex('pages_committed_tsv_idx')
    .on('pages')
    .using('GIN')
    .column('committed_tsv')
    .execute();

  // committed 검색 미러 트리거 — title/committed_text_content 변경 시에만
  await sql`
    CREATE OR REPLACE FUNCTION pages_committed_tsvector_trigger() RETURNS trigger AS $$
    begin
        new.committed_tsv :=
                  setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
                  setweight(to_tsvector('english', f_unaccent(substring(coalesce(new.committed_text_content, ''), 1, 1000000))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);
  await sql`
    CREATE TRIGGER pages_committed_tsvector_update
      BEFORE INSERT OR UPDATE OF title, committed_text_content ON pages
      FOR EACH ROW EXECUTE FUNCTION pages_committed_tsvector_trigger();
  `.execute(db);

  // 4. reviews.version_id — 리뷰의 버전 귀속 (레거시는 마이그레이션에서 v1 로)
  await db.schema
    .alterTable('reviews')
    .addColumn('version_id', 'uuid', (col) =>
      col.references('page_versions.id').onDelete('set null'),
    )
    .execute();

  // 5. shares — 버전 서빙 모드
  await db.schema
    .alterTable('shares')
    .addColumn('version_mode', 'varchar', (col) =>
      col.notNull().defaultTo('primary'),
    )
    .addColumn('fixed_version_id', 'uuid', (col) =>
      col.references('page_versions.id').onDelete('set null'),
    )
    .addColumn('on_discard', 'varchar', (col) =>
      col.notNull().defaultTo('fallback'),
    )
    .execute();

  // ── 데이터 마이그레이션 (D1) ─────────────────────────────────────────
  // Kysely 마이그레이션은 트랜잭션 안에서 실행됨 — 중간 실패 시 전체 롤백.

  // 6a. 페이지당 Primary 작업문서 1개 (content/ydoc 복사, 휴지통 포함)
  await sql`
    INSERT INTO page_working_docs
      (id, page_id, base_version_id, content, ydoc, text_content,
       creator_id, contributor_ids, space_id, workspace_id, created_at, updated_at)
    SELECT gen_uuid_v7(), p.id, NULL, p.content, p.ydoc, p.text_content,
           COALESCE(p.last_updated_by_id, p.creator_id), COALESCE(p.contributor_ids, '{}'),
           p.space_id, p.workspace_id, p.created_at, p.updated_at
    FROM pages p;
  `.execute(db);

  // 6b. 버전 0 — 생성 마커 (content NULL)
  await sql`
    INSERT INTO page_versions
      (id, page_id, version, title, icon, cover_photo, content, message,
       creator_id, contributor_ids, space_id, workspace_id, created_at, updated_at)
    SELECT gen_uuid_v7(), p.id, 0, p.title, p.icon, p.cover_photo, NULL, '페이지 생성',
           p.creator_id, '{}', p.space_id, p.workspace_id, p.created_at, p.created_at
    FROM pages p;
  `.execute(db);

  // 6c. 버전 1 — 현재 본문 자동 확정 (빈 본문도 빈 doc 으로 균일 확정: D2 공유 게이트 정합)
  await sql`
    INSERT INTO page_versions
      (id, page_id, version, title, icon, cover_photo, content, message,
       creator_id, contributor_ids, working_doc_id, space_id, workspace_id, created_at, updated_at)
    SELECT gen_uuid_v7(), p.id, 1, p.title, p.icon, p.cover_photo,
           COALESCE(p.content, '{"type":"doc","content":[]}'::jsonb), '기존 문서 자동 확정',
           COALESCE(p.last_updated_by_id, p.creator_id), COALESCE(p.contributor_ids, '{}'),
           wd.id, p.space_id, p.workspace_id, p.updated_at, p.updated_at
    FROM pages p
    JOIN page_working_docs wd ON wd.page_id = p.id;
  `.execute(db);

  // 6d. pages 링크 + committed 검색 미러 (트리거가 committed_tsv 갱신)
  await sql`
    UPDATE pages p
    SET primary_working_doc_id = wd.id,
        primary_version_id = v.id,
        committed_text_content = p.text_content
    FROM page_working_docs wd, page_versions v
    WHERE wd.page_id = p.id AND v.page_id = p.id AND v.version = 1;
  `.execute(db);

  // 6e. 작업문서의 base = 버전 1 ("버전 1에서 시작")
  await sql`
    UPDATE page_working_docs wd
    SET base_version_id = v.id
    FROM page_versions v
    WHERE v.page_id = wd.page_id AND v.version = 1;
  `.execute(db);

  // 6f. 기존 리뷰 → 버전 1 귀속
  await sql`
    UPDATE reviews r
    SET version_id = v.id
    FROM page_versions v
    WHERE v.page_id = r.page_id AND v.version = 1;
  `.execute(db);

  // ── 정합 검증 — 하나라도 어긋나면 throw 로 전체 롤백 ────────────────
  // 주의: 컬럼 별칭에 언더스코어 금지 — 앱 런타임의 Kysely 는 CamelCasePlugin 이
  // 켜져 있어 `orphan_reviews` 가 `orphanReviews` 로 변환된다 (러너별 키 불일치 사고 방지).
  const counts = await sql<{
    pages: string;
    wds: string;
    v0: string;
    v1: string;
    linked: string;
    based: string;
    orphans: string;
  }>`
    SELECT
      (SELECT count(*) FROM pages) AS pages,
      (SELECT count(*) FROM page_working_docs) AS wds,
      (SELECT count(*) FROM page_versions WHERE version = 0) AS v0,
      (SELECT count(*) FROM page_versions WHERE version = 1) AS v1,
      (SELECT count(*) FROM pages
        WHERE primary_version_id IS NOT NULL AND primary_working_doc_id IS NOT NULL) AS linked,
      (SELECT count(*) FROM page_working_docs WHERE base_version_id IS NOT NULL) AS based,
      (SELECT count(*) FROM reviews WHERE version_id IS NULL AND deleted_at IS NULL) AS orphans
  `.execute(db);

  const c = counts.rows[0];
  const n = (v: string) => Number(v);
  if (
    n(c.wds) !== n(c.pages) ||
    n(c.v0) !== n(c.pages) ||
    n(c.v1) !== n(c.pages) ||
    n(c.linked) !== n(c.pages) ||
    n(c.based) !== n(c.pages) ||
    n(c.orphans) !== 0
  ) {
    throw new Error(
      `[page-versions migration] integrity check failed: ${JSON.stringify(c)}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `[page-versions migration] pages=${c.pages} workingDocs=${c.wds} v0=${c.v0} v1=${c.v1} linked=${c.linked} orphanReviews=${c.orphans}`,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS pages_committed_tsvector_update ON pages`.execute(
    db,
  );
  await sql`DROP FUNCTION IF EXISTS pages_committed_tsvector_trigger`.execute(
    db,
  );

  await db.schema
    .alterTable('shares')
    .dropColumn('version_mode')
    .dropColumn('fixed_version_id')
    .dropColumn('on_discard')
    .execute();

  await db.schema.alterTable('reviews').dropColumn('version_id').execute();

  await db.schema.dropIndex('pages_committed_tsv_idx').execute();
  await db.schema
    .alterTable('pages')
    .dropColumn('primary_version_id')
    .dropColumn('primary_working_doc_id')
    .dropColumn('committed_text_content')
    .dropColumn('committed_tsv')
    .execute();

  // 순환 FK 때문에 CASCADE 로 상호 제약 제거
  await sql`DROP TABLE IF EXISTS page_versions CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS page_working_docs CASCADE`.execute(db);
}
