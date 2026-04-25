import { IUser } from "@/features/user/types/user.types";
import { QueryParams } from "@/lib/types.ts";

export type ReviewStatus = "open" | "progress" | "resolved";

export const REVIEW_STATUS_EMOJI: Record<ReviewStatus, string> = {
  open: "⏳",
  progress: "🔧",
  resolved: "✅",
};

export const REVIEW_ANCHOR_ICON = "💬";

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
  content?: any;
  assigneeUserIds?: string[];
  assigneeGroupIds?: string[];
}

export interface IChangeReviewStatus {
  reviewId: string;
  status: ReviewStatus;
}

export interface IAddReviewComment {
  reviewId: string;
  content: any;
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

export interface IReviewsByPageParams extends QueryParams {
  pageId: string;
  status?: ReviewStatus;
}

export interface IAssignedReviewsParams extends QueryParams {
  statuses?: ReviewStatus[];
}
