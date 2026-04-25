import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useSetAtom } from "jotai";
import { openReviewModalAtom } from "@/features/review/atoms/review-atom";
import type { ReviewAnchorStatus } from "@manadocs/editor-ext";
import {
  REVIEW_STATUS_PAGE_COLORS,
  reviewAnchorLabel,
} from "@/features/review/types/review.types";

export default function ReviewAnchorView(props: NodeViewProps) {
  const { node } = props;
  const { anchorId, reviewId, reviewSequenceId, sequenceId, status } =
    node.attrs as {
      anchorId: string;
      reviewId: string;
      sequenceId: number;
      reviewSequenceId: number;
      status: ReviewAnchorStatus;
    };
  const setOpenReviewModal = useSetAtom(openReviewModalAtom);

  const colors =
    REVIEW_STATUS_PAGE_COLORS[status] ?? REVIEW_STATUS_PAGE_COLORS.open;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (reviewId) setOpenReviewModal(reviewId);
  };

  return (
    <NodeViewWrapper as="span" style={{ display: "inline" }} data-drag-handle>
      <span
        role="button"
        tabIndex={0}
        className="review-anchor-target"
        data-anchor-id={anchorId}
        data-review-id={reviewId}
        data-status={status}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick(e as any);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "0 6px",
          margin: "0 1px",
          borderRadius: 10,
          fontSize: "0.85em",
          fontWeight: 600,
          lineHeight: 1.6,
          cursor: "pointer",
          backgroundColor: colors.bg,
          color: colors.fg,
          userSelect: "none",
          whiteSpace: "nowrap",
          opacity: status === "drop" ? 0.6 : 1,
        }}
      >
        {reviewAnchorLabel(reviewSequenceId, sequenceId)}
      </span>
    </NodeViewWrapper>
  );
}
