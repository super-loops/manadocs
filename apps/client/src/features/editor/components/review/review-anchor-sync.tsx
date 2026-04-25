import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { useParams } from "react-router-dom";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { usePageQuery } from "@/features/page/queries/page-query";
import { extractPageSlugId } from "@/lib";
import { useDeleteReviewAnchorMutation } from "@/features/review/queries/review-query";

/**
 * 페이지 본문에서 reviewAnchor 노드가 삭제되면 백엔드 anchor도 함께 삭제한다.
 * editor.on('update') 에서 직전 anchor IDs 와 현재를 비교해 사라진 것을 정리.
 */
export default function ReviewAnchorSync() {
  const editor = useAtomValue(pageEditorAtom);
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const deleteAnchor = useDeleteReviewAnchorMutation(page?.id);

  const lastIdsRef = useRef<Set<string>>(new Set());
  const deleteAnchorRef = useRef(deleteAnchor);
  deleteAnchorRef.current = deleteAnchor;

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    // 초기 anchor IDs
    try {
      const initial = collectAnchorIds(editor.state.doc);
      lastIdsRef.current = new Set(initial);
    } catch {
      lastIdsRef.current = new Set();
    }

    const handleUpdate = () => {
      if (editor.isDestroyed) return;
      let currentIds: string[];
      try {
        currentIds = collectAnchorIds(editor.state.doc);
      } catch {
        return;
      }
      const currentSet = new Set(currentIds);
      const removed = Array.from(lastIdsRef.current).filter(
        (id) => !currentSet.has(id),
      );
      lastIdsRef.current = currentSet;

      // 삭제된 anchor를 백엔드에서도 정리. mutation hook이 invalidate까지 처리.
      removed.forEach((anchorId) => {
        deleteAnchorRef.current.mutate({ anchorId });
      });
    };

    editor.on("update", handleUpdate);
    return () => {
      try {
        editor.off("update", handleUpdate);
      } catch {
        // editor가 이미 정리되었으면 무시
      }
    };
  }, [editor]);

  return null;
}

function collectAnchorIds(doc: any): string[] {
  const ids: string[] = [];
  doc.descendants((node: any) => {
    if (node?.type?.name === "reviewAnchor") {
      const id = node.attrs?.anchorId;
      if (id) ids.push(id);
    }
    return true;
  });
  return ids;
}
