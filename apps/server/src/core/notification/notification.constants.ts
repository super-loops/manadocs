export const NotificationType = {
  REVIEW_ASSIGNED: 'review.assigned',
  REVIEW_STATUS_CHANGED: 'review.status_changed',
  REVIEW_COMMENT_CREATED: 'review.comment_created',
  PAGE_USER_MENTION: 'page.user_mention',
  PAGE_PERMISSION_GRANTED: 'page.permission_granted',
  PAGE_UPDATED: 'page.updated',
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export type NotificationSettingKey =
  | 'page.updated'
  | 'page.userMention';

export const NotificationTypeToSettingKey: Partial<
  Record<NotificationType, NotificationSettingKey>
> = {
  [NotificationType.PAGE_UPDATED]: 'page.updated',
  [NotificationType.PAGE_USER_MENTION]: 'page.userMention',
};

export type NotificationTab = 'direct' | 'updates' | 'all';

export const DIRECT_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.REVIEW_ASSIGNED,
  NotificationType.REVIEW_STATUS_CHANGED,
  NotificationType.REVIEW_COMMENT_CREATED,
  NotificationType.PAGE_USER_MENTION,
  NotificationType.PAGE_PERMISSION_GRANTED,
];

export const UPDATES_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.PAGE_UPDATED,
];

export function getTypesForTab(tab: NotificationTab): NotificationType[] | undefined {
  if (tab === 'direct') return DIRECT_NOTIFICATION_TYPES;
  if (tab === 'updates') return UPDATES_NOTIFICATION_TYPES;
  return undefined;
}
