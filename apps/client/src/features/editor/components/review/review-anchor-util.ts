import type { Editor } from "@tiptap/react";

export interface ResolvedBlock {
  blockId: string;
  text: string;
}

/**
 * ProseMirror 위치에서 가장 가까운 (unique-id 를 가진) 블록을 해석한다.
 * 리뷰 앵커는 이 blockId 에 귀속된다. id 를 가진 블록(heading/paragraph 등)이
 * 조상에 없으면 null — 호출부에서 안내 후 취소한다.
 */
export function resolveBlockAtPos(
  editor: Editor,
  pos: number,
): ResolvedBlock | null {
  try {
    const $pos = editor.state.doc.resolve(pos);
    for (let depth = $pos.depth; depth >= 0; depth -= 1) {
      const node = $pos.node(depth);
      const id = node?.attrs?.id;
      if (id) {
        return { blockId: id, text: (node.textContent || "").slice(0, 120) };
      }
    }
  } catch {
    // resolve 실패 시 null
  }
  return null;
}

/** 현재 선택(anchor) 위치의 블록 해석 */
export function resolveBlockAtSelection(editor: Editor): ResolvedBlock | null {
  return resolveBlockAtPos(editor, editor.state.selection.from);
}
