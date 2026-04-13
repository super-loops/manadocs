import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useSetAtom } from "jotai";
import { openReviewModalAtom } from "@/features/review/atoms/review-atom";
import type { ReviewAnchorStatus } from "@manadocs/editor-ext";

const STATUS_COLORS: Record<ReviewAnchorStatus, { bg: string; fg: string }> = {
  open: { bg: "var(--mantine-color-violet-1)", fg: "var(--mantine-color-violet-8)" },
  progress: { bg: "var(--mantine-color-orange-1)", fg: "var(--mantine-color-orange-8)" },
  resolved: { bg: "var(--mantine-color-green-1)", fg: "var(--mantine-color-green-8)" },
};

export default function ReviewAnchorView(props: NodeViewProps) {
  const { node } = props;
  const { reviewId, reviewSequenceId, status } = node.attrs as {
    anchorId: string;
    reviewId: string;
    sequenceId: number;
    reviewSequenceId: number;
    status: ReviewAnchorStatus;
  };
  const setOpenReviewModal = useSetAtom(openReviewModalAtom);

  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.open;

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
        data-review-id={reviewId}
        data-status={status}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick(e as any);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
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
        }}
      >
        <span aria-hidden>⚓</span>
        <span>#RE_{reviewSequenceId}</span>
      </span>
    </NodeViewWrapper>
  );
}
