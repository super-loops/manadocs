import { type Kysely, sql } from 'kysely';

/**
 * 리뷰 앵커를 문서 콘텐츠에서 분리 — 특정 버전의 특정 블록(unique-id)에 귀속.
 * 기존엔 앵커 위치가 라이브 작업문서의 인라인 노드에만 존재해, 작업문서 전환·
 * 수정취소·버전 전환 시 조용히 소실됐다. version_id + block_id 를 DB 에 저장해
 * 위치를 콘텐츠와 독립시키고, 렌더는 decoration 으로 오버레이한다.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('review_anchors')
    .addColumn('version_id', 'uuid', (col) =>
      col.references('page_versions.id').onDelete('set null'),
    )
    .addColumn('block_id', 'varchar', (col) => col)
    .addColumn('selected_text', 'varchar', (col) => col)
    .execute();

  await db.schema
    .createIndex('review_anchors_version_id_idx')
    .on('review_anchors')
    .column('version_id')
    .execute();

  // 기존 앵커는 리뷰의 version_id 를 승계 (레거시 인라인 노드는 콘텐츠에 남아
  // 그대로 렌더되므로 block_id 는 채우지 않는다).
  await sql`
    UPDATE review_anchors ra
    SET version_id = r.version_id
    FROM reviews r
    WHERE r.id = ra.review_id AND r.version_id IS NOT NULL;
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('review_anchors_version_id_idx').execute();
  await db.schema
    .alterTable('review_anchors')
    .dropColumn('version_id')
    .dropColumn('block_id')
    .dropColumn('selected_text')
    .execute();
}
