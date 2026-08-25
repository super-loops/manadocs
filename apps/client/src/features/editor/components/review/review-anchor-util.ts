import type { Editor } from "@tiptap/react";

export interface ResolvedBlock {
  blockId: string;
  text: string;
}

/**
 * 리뷰 앵커를 달 수 없는 위치에서 보여주는 안내 문구.
 * 드롭존(드래그)과 /review 팝업이 같은 문장을 쓴다.
 */
export const REVIEW_ANCHOR_TARGET_HINT =
  "이 위치에는 리뷰를 달 수 없어요. 문단이나 제목에 달아주세요 — 리스트·표·콜아웃 안의 문단도 괜찮아요.";

/**
 * ProseMirror 위치에서 가장 가까운 (unique-id 를 가진) 블록을 해석한다.
 * 리뷰 앵커는 이 blockId 에 귀속된다.
 *
 * 앵커 대상 규칙 — unique-id 를 가진 블록이면 **중첩 위치를 가리지 않는다**.
 * UniqueID 확장은 `types: ["heading", "paragraph"]` 로 설정돼 있어(extensions.ts)
 * 리스트 항목·표 셀·콜아웃·인용문·컬럼 안의 문단에도 id 가 붙고, 그 문단은
 * 정식 앵커 대상이다. 데코레이션(review-anchor-decoration.ts)이 `doc.descendants`
 * 로 문서 전체를 훑어 blockId 를 찾으므로 중첩 문단도 동일하게 pill 이 그려지고,
 * 스냅샷 JSON 에 id 가 보존되므로 버전 전환·미리보기에서도 그대로 유지된다.
 *
 * 반대로 id 를 가진 조상이 없는 자리(코드블럭·이미지/비디오/첨부·구분선·표 자체
 * 등)는 null — 호출부에서 REVIEW_ANCHOR_TARGET_HINT 로 안내 후 취소한다.
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
