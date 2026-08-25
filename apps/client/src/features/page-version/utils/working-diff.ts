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
  /** 목록 렌더/식별용 안정 키 */
  key: string;
  status: BlockDiffStatus;
  /**
   * unique-id — heading/paragraph 에만 붙는다. 리스트·표·코드블럭 등
   * id 없는 최상위 블럭은 null 이고 인덱스로 위치를 찾는다.
   */
  blockId: string | null;
  /** 최상위 노드 타입 (미리보기 라벨용) */
  nodeType: string;
  /** current 문서에서의 최상위 인덱스 — modified/added */
  currentIndex: number | null;
  /** base 문서에서의 최상위 인덱스 — modified/removed */
  baseIndex: number | null;
  /** removed 를 되돌릴 때 current 문서에 삽입할 최상위 인덱스 */
  insertIndex: number | null;
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

/** 목록·표처럼 자식이 여러 항목인 블럭 — 미리보기에서 항목을 구분해 보여준다 */
const SEGMENTED_BLOCKS = new Set([
  "bulletList",
  "orderedList",
  "taskList",
  "table",
  "tableRow",
]);
const SEGMENT_SEPARATOR = " · ";

function plainText(node: any): string {
  const parts: string[] = [];
  const walk = (n: any) => {
    if (typeof n?.text === "string") parts.push(n.text);
    (n?.content ?? []).forEach(walk);
  };
  walk(node);
  return parts.join("");
}

function segmentedText(node: any): string {
  if (SEGMENTED_BLOCKS.has(node?.type) && Array.isArray(node.content)) {
    return node.content
      .map(segmentedText)
      .filter((text: string) => text.length > 0)
      .join(SEGMENT_SEPARATOR);
  }
  return plainText(node);
}

function blockText(node: any): string {
  // 항목 사이에 구분자가 없으면 "항목 A항목 B항목 C" 로 붙어 읽을 수 없다
  return segmentedText(node).slice(0, 120);
}

// ── 최상위 블럭 정렬 ──────────────────────────────────────────────

/**
 * 두 블럭이 "같은 블럭"인가.
 * - 양쪽 다 unique-id 가 있으면 id 로 (heading/paragraph)
 * - 양쪽 다 id 가 없으면(리스트·표·코드블럭 …) 내용이 같을 때만
 *   확실한 앵커로 인정한다. 내용이 바뀐 id 없는 블럭은 앵커가 못 되고
 *   아래 비매칭 구간에서 타입 기준으로 짝지어 "수정"으로 잡는다.
 */
function sameBlock(a: any, b: any): boolean {
  const ia = blockId(a);
  const ib = blockId(b);
  if (ia && ib) return ia === ib;
  if (!ia && !ib) return deepEqual(a, b);
  return false;
}

type AlignStep = { b: number | null; c: number | null };

/** 최상위 블럭 수가 이보다 많으면 LCS DP 대신 인덱스 정렬로 폴백 */
const MAX_LCS_BLOCKS = 400;

function alignTopBlocks(base: any[], current: any[]): AlignStep[] {
  const n = base.length;
  const m = current.length;

  if (n > MAX_LCS_BLOCKS || m > MAX_LCS_BLOCKS) {
    const flat: AlignStep[] = [];
    for (let i = 0; i < Math.max(n, m); i += 1) {
      flat.push({ b: i < n ? i : null, c: i < m ? i : null });
    }
    return flat;
  }

  // LCS DP (뒤에서부터)
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = sameBlock(base[i], current[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const steps: AlignStep[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (sameBlock(base[i], current[j])) {
      steps.push({ b: i, c: j });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      steps.push({ b: i, c: null });
      i += 1;
    } else {
      steps.push({ b: null, c: j });
      j += 1;
    }
  }
  while (i < n) {
    steps.push({ b: i, c: null });
    i += 1;
  }
  while (j < m) {
    steps.push({ b: null, c: j });
    j += 1;
  }
  return steps;
}

function makeEntry(
  status: BlockDiffStatus,
  node: any,
  baseIndex: number | null,
  currentIndex: number | null,
  insertIndex: number | null,
): BlockDiffEntry {
  return {
    key: `${status}:${baseIndex ?? "-"}:${currentIndex ?? "-"}`,
    status,
    blockId: blockId(node),
    nodeType: node?.type ?? "unknown",
    currentIndex,
    baseIndex,
    insertIndex,
    preview: blockText(node),
  };
}

/**
 * 최상위 블럭을 정렬해 base ↔ current 차이를 낸다.
 * heading/paragraph 는 unique-id 로, 그 외(리스트·표·코드블럭 …)는 내용/타입
 * 정렬로 잡으므로 **id 없는 블럭의 변경도 목록에서 빠지지 않는다**.
 * 블럭별 수정취소 목록의 원천.
 */
export function computeBlockDiff(
  baseContent: any,
  currentContent: any,
): BlockDiffEntry[] {
  const base = topBlocks(baseContent);
  const current = topBlocks(currentContent);
  const steps = alignTopBlocks(base, current);

  // 각 정렬 지점에서 "current 쪽 다음 생존 블럭"의 인덱스 — 삭제 블럭을
  // 되돌릴 때 어디에 끼워 넣을지 계산하는 데 쓴다.
  const nextCurrentIndex: number[] = new Array(steps.length);
  let nc = current.length;
  for (let x = steps.length - 1; x >= 0; x -= 1) {
    if (steps[x].c !== null) nc = steps[x].c as number;
    nextCurrentIndex[x] = nc;
  }

  const entries: BlockDiffEntry[] = [];
  let k = 0;

  while (k < steps.length) {
    const step = steps[k];

    // 짝이 지어진 블럭 — 내용이 다르면 수정
    if (step.b !== null && step.c !== null) {
      if (!deepEqual(base[step.b], current[step.c])) {
        entries.push(
          makeEntry("modified", current[step.c], step.b, step.c, null),
        );
      }
      k += 1;
      continue;
    }

    // 비매칭 구간 — 삭제 후보와 추가 후보를 모아 타입이 같으면 "수정"으로 짝짓기
    const removed: Array<{ baseIndex: number; insertIndex: number }> = [];
    const added: number[] = [];
    while (
      k < steps.length &&
      !(steps[k].b !== null && steps[k].c !== null)
    ) {
      if (steps[k].b !== null) {
        removed.push({
          baseIndex: steps[k].b as number,
          insertIndex: nextCurrentIndex[k],
        });
      } else {
        added.push(steps[k].c as number);
      }
      k += 1;
    }

    const pairCount = Math.min(removed.length, added.length);
    let paired = 0;
    for (let x = 0; x < pairCount; x += 1) {
      const baseNode = base[removed[x].baseIndex];
      const curNode = current[added[x]];
      if (baseNode?.type !== curNode?.type) break; // 타입이 다르면 삭제+추가로
      if (!deepEqual(baseNode, curNode)) {
        entries.push(
          makeEntry("modified", curNode, removed[x].baseIndex, added[x], null),
        );
      }
      paired += 1;
    }

    for (let x = paired; x < added.length; x += 1) {
      entries.push(makeEntry("added", current[added[x]], null, added[x], null));
    }
    for (let x = paired; x < removed.length; x += 1) {
      entries.push(
        makeEntry(
          "removed",
          base[removed[x].baseIndex],
          removed[x].baseIndex,
          null,
          removed[x].insertIndex,
        ),
      );
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

/** 라이브 에디터의 index 번째 최상위 블럭 (없으면 null) */
function topLevelAt(
  editor: Editor,
  index: number | null,
): { pos: number; node: PMNode } | null {
  const doc = editor.state.doc;
  if (index === null || index < 0 || index >= doc.childCount) return null;
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += doc.child(i).nodeSize;
  return { pos, node: doc.child(index) };
}

/** 라이브 에디터에서 index 번째 최상위 블럭 앞의 삽입 위치 */
function topLevelInsertPos(editor: Editor, index: number | null): number {
  const doc = editor.state.doc;
  const clamped = Math.max(0, Math.min(index ?? doc.childCount, doc.childCount));
  let pos = 0;
  for (let i = 0; i < clamped; i += 1) pos += doc.child(i).nodeSize;
  return pos;
}

/** entry 가 가리키는 current 블럭을 라이브 에디터에서 해석 (id 우선, 없으면 인덱스) */
function resolveCurrentBlock(
  editor: Editor,
  entry: BlockDiffEntry,
): { pos: number; node: PMNode } | null {
  if (entry.blockId) {
    const byId = findBlockPos(editor, entry.blockId);
    if (byId) return byId;
  }
  return topLevelAt(editor, entry.currentIndex);
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
    const target = resolveCurrentBlock(editor, entry);
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
    const baseNode =
      (entry.blockId
        ? base.find((n) => blockId(n) === entry.blockId)
        : undefined) ??
      (entry.baseIndex !== null ? base[entry.baseIndex] : undefined);
    if (!baseNode) return false;
    const target = resolveCurrentBlock(editor, entry);
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
    const baseNode = entry.baseIndex !== null ? base[entry.baseIndex] : null;
    if (!baseNode) return false;
    return editor
      .chain()
      .insertContentAt(topLevelInsertPos(editor, entry.insertIndex), baseNode, {
        updateSelection: false,
      })
      .run();
  }

  return false;
}
