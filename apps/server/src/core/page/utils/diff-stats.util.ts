import { getSchema } from '@tiptap/core';
import { Node as PMNode, Schema } from '@tiptap/pm/model';
import { ChangeSet, simplifyChanges } from '@tiptap/pm/changeset';
import { recreateTransform } from '@manadocs/editor-ext';
import { tiptapExtensions } from '../../../collaboration/collaboration.util';

export interface DiffStats {
  added: number;
  deleted: number;
}

export const EMPTY_DOC = { type: 'doc', content: [] };

/**
 * 사실상 빈 문서인가 — 갓 만든 페이지는 빈 문단 하나를 들고 있다.
 * 빈 문서 대비 diff 는 그 문단 삽입을 +1 로 세므로, "수정중" 판정에서는
 * 이 모양을 변경 없음으로 취급해야 새 페이지가 목록을 오염시키지 않는다.
 */
export function isBlankDoc(content: any): boolean {
  const nodes = Array.isArray(content?.content) ? content.content : [];
  if (nodes.length === 0) return true;
  if (nodes.length > 1) return false;
  const only = nodes[0];
  return (
    only?.type === 'paragraph' &&
    !(Array.isArray(only.content) && only.content.length > 0)
  );
}

/**
 * 스키마 조립은 비싸므로 프로세스당 한 번만 한다.
 * 협업 저장이 쓰는 것과 같은 확장 목록이라, 저장된 문서는 항상 이 스키마로
 * 파싱된다.
 */
let cachedSchema: Schema | null = null;
function editorSchema(): Schema {
  if (!cachedSchema) cachedSchema = getSchema(tiptapExtensions);
  return cachedSchema;
}

/**
 * 두 문서의 변경 통계(추가/삭제 세그먼트 수).
 *
 * 클라이언트 footer pill 의 computeDiffStats(working-diff.ts)와 **같은 엔진·같은
 * 옵션**이다. 사이드바 "수정중" 뱃지와 footer 의 +N -N 이 어긋나 보이면 안 되므로
 * 여기를 바꾸면 저쪽도 함께 맞춰야 한다.
 */
export function computeDiffStats(
  baseContent: any,
  currentContent: any,
): DiffStats {
  const empty: DiffStats = { added: 0, deleted: 0 };
  if (!currentContent) return empty;
  try {
    const schema = editorSchema();
    const oldDoc = PMNode.fromJSON(schema, baseContent ?? EMPTY_DOC);
    const newDoc = PMNode.fromJSON(schema, currentContent);
    const tr = recreateTransform(oldDoc, newDoc, {
      complexSteps: false,
      wordDiffs: true,
      simplifyDiff: true,
    });
    const changeSet = ChangeSet.create(oldDoc).addSteps(
      tr.doc,
      tr.mapping.maps,
      [],
    );
    const changes = simplifyChanges(changeSet.changes, newDoc);
    let added = 0;
    let deleted = 0;
    for (const change of changes) {
      if (change.toB > change.fromB) added += 1;
      if (change.toA > change.fromA) deleted += 1;
    }
    return { added, deleted };
  } catch {
    // 스키마에 없는 노드 등으로 파싱이 실패하면 통계를 포기한다.
    // 호출부는 통계 0 인 항목을 목록에서 제외하므로 조용히 빠진다.
    return empty;
  }
}
