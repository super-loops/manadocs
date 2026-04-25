import { IUser } from "@/features/user/types/user.types";
import { QueryParams } from "@/lib/types.ts";

export type ReviewStatus = "open" | "progress" | "resolved" | "drop";

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  open: "Open",
  progress: "In Progress",
  resolved: "Resolved",
  drop: "Drop",
};

export const REVIEW_STATUS_ABBREV: Record<ReviewStatus, string> = {
  open: "O",
  progress: "P",
  resolved: "R",
  drop: "D",
};

/**
 * 페이지 본문 anchor 인라인 뱃지의 색상 매핑.
 * 상태는 색으로만 식별한다 (텍스트 약어/이모지를 따로 두지 않음).
 */
export const REVIEW_STATUS_PAGE_COLORS: Record<
  ReviewStatus,
  { bg: string; fg: string }
> = {
  open: {
    bg: "var(--mantine-color-violet-1)",
    fg: "var(--mantine-color-violet-8)",
  },
  progress: {
    bg: "var(--mantine-color-orange-1)",
    fg: "var(--mantine-color-orange-8)",
  },
  resolved: {
    bg: "var(--mantine-color-green-1)",
    fg: "var(--mantine-color-green-8)",
  },
  drop: {
    bg: "var(--mantine-color-gray-1)",
    fg: "var(--mantine-color-gray-5)",
  },
};

/** 페이지 본문 인라인 anchor 뱃지에서 쓰는 아이콘 */
export const REVIEW_ANCHOR_ICON = "💬";
/** 사이드바 카드/디테일 헤더에서 쓰는 아이콘 */
export const REVIEW_LIST_ICON = "⚓";

/** 사이드바 카드/디테일 패널 헤더 라벨: `⚓ #1` (대괄호는 Badge 시각으로 표현) */
export function reviewSidebarLabel(reviewSeq: number | string): string {
  return `${REVIEW_LIST_ICON} #${reviewSeq}`;
}

/** 페이지 본문 anchor 뱃지/Anchors 목록 라벨: `💬 #1:1` (대괄호는 Badge 시각으로 표현) */
export function reviewAnchorLabel(
  reviewSeq: number | string,
  anchorSeq: number | string,
): string {
  return `${REVIEW_ANCHOR_ICON} #${reviewSeq}:${anchorSeq}`;
}

export interface IReviewCreator {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface IReviewGroup {
  id: string;
  name: string;
}

export interface IReviewAssignee {
  id: string;
  userId: string | null;
  groupId: string | null;
  createdAt: Date;
  user?: IReviewCreator | null;
  group?: IReviewGroup | null;
}

export interface IReviewAnchorPage {
  id: string;
  title: string | null;
  slugId: string;
  spaceId: string;
}

export interface IReviewAnchor {
  id: string;
  sequenceId: number | string;
  reviewId: string;
  pageId: string;
  workspaceId: string;
  creatorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  page?: IReviewAnchorPage | null;
}

export interface IReviewHistory {
  id: string;
  reviewId: string;
  type: string;
  content: any | null;
  oldStatus: ReviewStatus | null;
  newStatus: ReviewStatus | null;
  creatorId: string | null;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date | null;
  deletedAt?: Date | null;
  creator?: IReviewCreator | null;
}

export interface IReview {
  id: string;
  sequenceId: number | string;
  title: string | null;
  status: ReviewStatus;
  content: any | null;
  creatorId: string | null;
  pageId: string | null;
  spaceId: string;
  workspaceId: string;
  resolvedAt: Date | null;
  resolvedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;

  creator?: IReviewCreator | null;
  assignees?: IReviewAssignee[];
  anchors?: IReviewAnchor[];
  anchorCount?: number;
  histories?: IReviewHistory[];
}

export interface ICreateReview {
  pageId: string;
  title?: string;
  content?: string;
  assigneeUserIds?: string[];
  assigneeGroupIds?: string[];
}

export interface IChangeReviewStatus {
  reviewId: string;
  status: ReviewStatus;
}

export interface IAddReviewComment {
  reviewId: string;
  content: string;
}

export interface ICreateReviewAnchor {
  reviewId: string;
  pageId: string;
}

export interface IDeleteReviewAnchor {
  anchorId: string;
}

export interface IUpdateReviewAssignees {
  reviewId: string;
  assigneeUserIds?: string[];
  assigneeGroupIds?: string[];
}

export interface IUpdateReview {
  reviewId: string;
  title?: string;
  content?: string;
}

export interface IUpdateReviewComment {
  historyId: string;
  content: string;
}

export interface IDeleteReviewComment {
  historyId: string;
}

export interface IReviewsByPageParams extends QueryParams {
  pageId: string;
  status?: ReviewStatus;
}

export interface IAssignedReviewsParams extends QueryParams {
  statuses?: ReviewStatus[];
}
