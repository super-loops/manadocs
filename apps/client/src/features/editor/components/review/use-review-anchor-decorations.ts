import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import type { ReviewAnchorDeco } from "@manadocs/editor-ext";
import { useReviewAnchorsQuery } from "@/features/review/queries/review-query";
import {
  REVIEW_STATUS_PAGE_COLORS,
  reviewAnchorLabel,
} from "@/features/review/types/review.types";

/**
 * 페이지 앵커를 조회해 에디터의 decoration 플러그인에 주입한다.
 * blockId 를 가진(신규 방식) 앵커만 오버레이하며, 레거시(인라인 노드) 앵커는
 * 콘텐츠에 남아 그대로 렌더되므로 여기서 제외한다.
 * 라이브 에디터와 읽기전용(미리보기/확정본) 양쪽에서 사용.
 */
export function useReviewAnchorDecorations(
  editor: Editor | null | undefined,
  pageId: string | null | undefined,
  enabled = true,
) {
  const { data: anchors } = useReviewAnchorsQuery(enabled ? pageId : null);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (!(editor.commands as any).setReviewAnchorDecorations) return;

    const decos: ReviewAnchorDeco[] = (anchors ?? [])
      .filter((a) => !!a.blockId)
      .map((a) => {
        const review = (a as any).review ?? {};
        const status = (a.reviewStatus ?? review.status ?? "open") as string;
        const colors =
          REVIEW_STATUS_PAGE_COLORS[
            status as keyof typeof REVIEW_STATUS_PAGE_COLORS
          ] ?? REVIEW_STATUS_PAGE_COLORS.open;
        const reviewSeq = a.reviewSequenceId ?? review.sequenceId ?? 0;
        return {
          anchorId: a.id,
          reviewId: a.reviewId,
          blockId: a.blockId as string,
          label: reviewAnchorLabel(reviewSeq, a.sequenceId),
          bg: colors.bg,
          fg: colors.fg,
          status,
        };
      });

    try {
      (editor.commands as any).setReviewAnchorDecorations(decos);
    } catch {
      // 에디터가 아직 준비되지 않았으면 다음 렌더에서 재시도
    }
  }, [editor, anchors]);
}
