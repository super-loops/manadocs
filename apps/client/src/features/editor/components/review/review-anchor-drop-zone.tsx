import { useEffect } from "react";
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

  useEffect(() => {
    if (!editor || !page) return;
    const dom = editor.view.dom as HTMLElement;

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
      if (!reviewId) return;

      const coords = { left: e.clientX, top: e.clientY };
      const posInfo = editor.view.posAtCoords(coords);
      if (!posInfo) return;
      const pos = posInfo.pos;

      try {
        const anchor = await createAnchor.mutateAsync({
          reviewId,
          pageId: page.id,
        });
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
      dom.removeEventListener("dragover", handleDragOver);
      dom.removeEventListener("drop", handleDrop);
    };
  }, [editor, page?.id, createAnchor]);

  return null;
}
