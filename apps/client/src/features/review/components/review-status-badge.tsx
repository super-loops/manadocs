import { Badge, BadgeProps } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  REVIEW_STATUS_ABBREV,
  REVIEW_STATUS_LABEL,
  ReviewStatus,
} from "@/features/review/types/review.types";

interface ReviewStatusBadgeProps extends Omit<BadgeProps, "color" | "children"> {
  status: ReviewStatus;
  /** "abbrev" → `(O)` only / "abbrev-label" → `(O) Open` */
  format?: "abbrev" | "abbrev-label";
}

export default function ReviewStatusBadge({
  status,
  variant = "light",
  size = "sm",
  format = "abbrev-label",
  ...rest
}: ReviewStatusBadgeProps) {
  const { t } = useTranslation();
  const abbrev = REVIEW_STATUS_ABBREV[status];
  const label = t(REVIEW_STATUS_LABEL[status]);
  const text =
    format === "abbrev" ? `(${abbrev})` : `(${abbrev}) ${label}`;
  return (
    <Badge color="gray" variant={variant} size={size} {...rest}>
      {text}
    </Badge>
  );
}
