import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { useParams } from "react-router-dom";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { usePageQuery } from "@/features/page/queries/page-query";
import { extractPageSlugId } from "@/lib";
import { useCreateReviewAnchorMutation } from "@/features/review/queries/review-query";

export const REVIEW_DRAG_MIME = "application/x-manadocs-review-id";

/**
 * 페이지 에디터 위에 드래그된 리뷰 앵커를 받기 위한 보이지 않는 컴포넌트.
 * - 드래그 데이터가 application/x-manadocs-review-id 인 경우만 처리
 * - 드롭 위치를 ProseMirror 좌표로 변환해 createReviewAnchor 호출 후 노드 삽입
 */
export default function ReviewAnchorDropZone() {
  const editor = useAtomValue(pageEditorAtom);
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const createAnchor = useCreateReviewAnchorMutation();

  // mutation 객체는 매 렌더 새로 만들어지므로 useEffect 의존성에서 제외하고
  // ref로 최신 핸들만 들고 가서 안에서 호출한다.
  const createAnchorRef = useRef(createAnchor);
  createAnchorRef.current = createAnchor;
  const pageIdRef = useRef(page?.id);
  pageIdRef.current = page?.id;

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    let dom: HTMLElement;
    try {
      dom = editor.view.dom as HTMLElement;
    } catch {
      // view가 아직 마운트되지 않았거나 이미 정리된 경우
      return;
    }
    if (!dom) return;

    const isReviewDrag = (e: DragEvent) => {
      const types = e.dataTransfer?.types;
      if (!types) return false;
      for (let i = 0; i < types.length; i += 1) {
        if (types[i] === REVIEW_DRAG_MIME) return true;
      }
      return false;
    };

    const handleDragOver = (e: DragEvent) => {
      if (!isReviewDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = async (e: DragEvent) => {
      if (!isReviewDrag(e)) return;
      e.preventDefault();
      const reviewId = e.dataTransfer?.getData(REVIEW_DRAG_MIME);
      const pageId = pageIdRef.current;
      if (!reviewId || !pageId) return;
      if (editor.isDestroyed) return;

      let pos: number;
      try {
        const posInfo = editor.view.posAtCoords({
          left: e.clientX,
          top: e.clientY,
        });
        if (!posInfo) return;
        pos = posInfo.pos;
      } catch {
        return;
      }

      try {
        const anchor = await createAnchorRef.current.mutateAsync({
          reviewId,
          pageId,
        });
        if (editor.isDestroyed) return;
        editor
          .chain()
          .focus()
          .setTextSelection(pos)
          .insertReviewAnchor({
            anchorId: anchor.id,
            reviewId,
            sequenceId: Number(anchor.sequenceId),
            reviewSequenceId: Number((anchor as any).reviewSequenceId ?? 0),
            status: ((anchor as any).reviewStatus ?? "open") as any,
          })
          .run();
      } catch {
        // notification은 mutation hook이 처리
      }
    };

    dom.addEventListener("dragover", handleDragOver);
    dom.addEventListener("drop", handleDrop);
    return () => {
      try {
        dom.removeEventListener("dragover", handleDragOver);
        dom.removeEventListener("drop", handleDrop);
      } catch {
        // dom이 이미 분리되었으면 무시
      }
    };
  }, [editor]);

  return null;
}
