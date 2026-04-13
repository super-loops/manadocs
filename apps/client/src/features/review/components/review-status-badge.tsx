import { Badge, BadgeProps } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { ReviewStatus } from "@/features/review/types/review.types";

interface ReviewStatusBadgeProps extends Omit<BadgeProps, "color" | "children"> {
  status: ReviewStatus;
}

const STATUS_COLOR: Record<ReviewStatus, string> = {
  open: "violet",
  progress: "orange",
  resolved: "green",
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  open: "Open",
  progress: "In Progress",
  resolved: "Resolved",
};

export default function ReviewStatusBadge({
  status,
  variant = "light",
  size = "sm",
  ...rest
}: ReviewStatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <Badge
      color={STATUS_COLOR[status]}
      variant={variant}
      size={size}
      {...rest}
    >
      {t(STATUS_LABEL[status])}
    </Badge>
  );
}
