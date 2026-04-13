import { MentionNode } from '../../../common/helpers/prosemirror/utils';

export interface IPageBacklinkJob {
  pageId: string;
  workspaceId: string;
  mentions: MentionNode[];
}

export interface IAddPageWatchersJob {
  userIds: string[];
  pageId: string;
  spaceId: string;
  workspaceId: string;
}

export interface IStripeSeatsSyncJob {
  workspaceId: string;
}

export interface IPageHistoryJob {
  pageId: string;
}

export interface INotificationCreateJob {
  userId: string;
  workspaceId: string;
  type: string;
  actorId?: string;
  pageId?: string;
  spaceId?: string;
  data?: Record<string, unknown>;
}

export interface IPageMentionNotificationJob {
  userMentions: { userId: string; mentionId: string; creatorId: string }[];
  oldMentionedUserIds: string[];
  pageId: string;
  spaceId: string;
  workspaceId: string;
}

export interface IPageUpdateNotificationJob {
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorIds: string[];
}

export interface IReviewAssignedNotificationJob {
  reviewId: string;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorId: string;
}

export interface IReviewStatusChangedNotificationJob {
  reviewId: string;
  oldStatus: string;
  newStatus: string;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorId: string;
}

export interface IReviewCommentCreatedNotificationJob {
  reviewId: string;
  historyId: string;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorId: string;
}

export interface IPermissionGrantedNotificationJob {
  userIds: string[];
  pageId: string;
  spaceId: string;
  workspaceId: string;
  actorId: string;
  role: string;
}
