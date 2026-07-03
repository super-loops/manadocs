import type { Editor } from "@tiptap/react";
import { Node as PMNode } from "@tiptap/pm/model";
import { recreateTransform } from "@manadocs/editor-ext";
import { ChangeSet, simplifyChanges } from "@tiptap/pm/changeset";

export interface DiffStats {
  added: number;
  deleted: number;
  total: number;
}

export type BlockDiffStatus = "modified" | "added" | "removed";

export interface BlockDiffEntry {
  /** unique-id of the block (in current for modified/added, in base for removed) */
  blockId: string;
  status: BlockDiffStatus;
  /** 미리보기 텍스트 */
  preview: string;
}

/** 키 순서 무관 deep-equal — 서버 저장 JSON ↔ 에디터 getJSON() 비교용 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) {
    // null/undefined 를 동치로 (attrs 누락 vs null)
    return a == null && b == null;
  }
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return false;
    for (let i = 0; i < a.length; i += 1)
      if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

function topBlocks(content: any): any[] {
  return Array.isArray(content?.content) ? content.content : [];
}

function blockId(node: any): string | null {
  return node?.attrs?.id ?? null;
}

function blockText(node: any): string {
  const parts: string[] = [];
  const walk = (n: any) => {
    if (typeof n?.text === "string") parts.push(n.text);
    (n?.content ?? []).forEach(walk);
  };
  walk(node);
  return parts.join("").slice(0, 120);
}

/**
 * 최상위 블럭을 unique-id 로 매칭해 base ↔ current 차이를 낸다.
 * 블럭별 수정취소 목록의 원천. id 없는 블럭은 매칭 불가라 무시(안내).
 */
export function computeBlockDiff(
  baseContent: any,
  currentContent: any,
): BlockDiffEntry[] {
  const base = topBlocks(baseContent);
  const current = topBlocks(currentContent);

  const baseById = new Map<string, any>();
  base.forEach((n) => {
    const id = blockId(n);
    if (id) baseById.set(id, n);
  });
  const currentById = new Map<string, any>();
  current.forEach((n) => {
    const id = blockId(n);
    if (id) currentById.set(id, n);
  });

  const entries: BlockDiffEntry[] = [];

  // 수정 / 추가 (current 순서 유지)
  for (const node of current) {
    const id = blockId(node);
    if (!id) continue;
    const baseNode = baseById.get(id);
    if (!baseNode) {
      entries.push({ blockId: id, status: "added", preview: blockText(node) });
    } else if (!deepEqual(baseNode, node)) {
      entries.push({
        blockId: id,
        status: "modified",
        preview: blockText(node),
      });
    }
  }

  // 삭제 (base 에만 존재)
  for (const node of base) {
    const id = blockId(node);
    if (!id) continue;
    if (!currentById.has(id)) {
      entries.push({
        blockId: id,
        status: "removed",
        preview: blockText(node),
      });
    }
  }

  return entries;
}

/**
 * ChangeSet 기반 변경 통계(added/deleted 세그먼트 수). history-editor 와 동일
 * 계산이되 decoration 없이 카운트만. footer +/- 표시용.
 */
export function computeDiffStats(
  editor: Editor | null | undefined,
  baseContent: any,
  currentContent: any,
): DiffStats {
  const empty: DiffStats = { added: 0, deleted: 0, total: 0 };
  if (!editor || !baseContent || !currentContent) return empty;
  try {
    const schema = editor.schema;
    const oldDoc = PMNode.fromJSON(schema, baseContent);
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
    return { added, deleted, total: added + deleted };
  } catch {
    return empty;
  }
}

/** current 문서 == base 문서인가 (변경 없음 판정, 키 순서 무관) */
export function isUnchanged(baseContent: any, currentContent: any): boolean {
  if (!baseContent || !currentContent) return false;
  return deepEqual(baseContent, currentContent);
}

/**
 * 서버 저장 JSON 을 에디터 스키마로 정규화(왕복) — 클라 getJSON() 과 같은
 * 형태로 맞춰 블럭 비교의 직렬화 비대칭을 제거한다.
 */
export function normalizeContent(editor: Editor, content: any): any {
  try {
    return PMNode.fromJSON(editor.schema, content).toJSON();
  } catch {
    return content;
  }
}

/** 라이브 에디터에서 id 로 최상위 블럭의 위치(before-pos)와 노드를 찾는다 */
function findBlockPos(
  editor: Editor,
  id: string,
): { pos: number; node: PMNode } | null {
  let found: { pos: number; node: PMNode } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.attrs?.id === id) {
      found = { pos, node };
      return false;
    }
    return true;
  });
  return found;
}

/**
 * 블럭별 수정취소 — 라이브 에디터에서 한 블럭을 base 상태로 되돌린다.
 * yjs 로 동기화된다.
 * - modified: current 블럭을 base 블럭으로 교체
 * - added: current 블럭 삭제
 * - removed: base 블럭을 원래 순서 위치에 재삽입
 */
export function revertBlock(
  editor: Editor,
  entry: BlockDiffEntry,
  baseContent: any,
): boolean {
  const base = topBlocks(baseContent);

  if (entry.status === "added") {
    const target = findBlockPos(editor, entry.blockId);
    if (!target) return false;
    // 추가된 블럭 삭제
    return editor
      .chain()
      .deleteRange({
        from: target.pos,
        to: target.pos + target.node.nodeSize,
      })
      .run();
  }

  if (entry.status === "modified") {
    const baseNode = base.find((n) => blockId(n) === entry.blockId);
    if (!baseNode) return false;
    const target = findBlockPos(editor, entry.blockId);
    if (!target) return false;
    // 현재 블럭 범위를 base 블럭으로 교체 (스키마 파싱은 insertContentAt 위임)
    return editor
      .chain()
      .insertContentAt(
        { from: target.pos, to: target.pos + target.node.nodeSize },
        baseNode,
        { updateSelection: false },
      )
      .run();
  }

  if (entry.status === "removed") {
    const baseIndex = base.findIndex((n) => blockId(n) === entry.blockId);
    if (baseIndex < 0) return false;
    const baseNode = base[baseIndex];
    // 앞쪽에서 현재 문서에도 존재하는 가장 가까운 블럭을 찾아 그 뒤에 삽입
    let insertPos = 0;
    for (let i = baseIndex - 1; i >= 0; i -= 1) {
      const prevId = blockId(base[i]);
      if (!prevId) continue;
      const prevTarget = findBlockPos(editor, prevId);
      if (prevTarget) {
        insertPos = prevTarget.pos + prevTarget.node.nodeSize;
        break;
      }
    }
    return editor
      .chain()
      .insertContentAt(insertPos, baseNode, { updateSelection: false })
      .run();
  }

  return false;
}
