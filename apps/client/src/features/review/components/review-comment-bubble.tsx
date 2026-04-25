import { useCallback, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { useTimeAgo } from "@/hooks/use-time-ago";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  useDeleteReviewCommentMutation,
  useUpdateReviewCommentMutation,
} from "@/features/review/queries/review-query";
import { IReviewHistory } from "@/features/review/types/review.types";
import ReviewMarkdown from "./review-markdown";
import ReviewEditor from "./review-editor";

interface ReviewCommentBubbleProps {
  history: IReviewHistory;
  reviewId: string;
}

function toMarkdownString(content: any): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  return "";
}

function isLegacyTiptapJson(content: any): boolean {
  return (
    content !== null &&
    typeof content === "object" &&
    typeof (content as any).type === "string"
  );
}

export default function ReviewCommentBubble({
  history,
  reviewId,
}: ReviewCommentBubbleProps) {
  const { t } = useTranslation();
  const currentUser = useAtomValue(currentUserAtom);
  const updateMutation = useUpdateReviewCommentMutation(reviewId);
  const deleteMutation = useDeleteReviewCommentMutation(reviewId);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(toMarkdownString(history.content));

  const createdAtAgo = useTimeAgo(history.createdAt);
  const editedAtAgo = useTimeAgo(history.editedAt ?? history.createdAt);
  const creatorName = history.creator?.name || t("Unknown");
  const isOwner =
    !!currentUser?.user?.id && history.creatorId === currentUser.user.id;
  const isDeleted = !!history.deletedAt;
  const isEdited = !!history.editedAt && !isDeleted;

  const handleStartEdit = useCallback(() => {
    setDraft(toMarkdownString(history.content));
    setIsEditing(true);
  }, [history.content]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    await updateMutation.mutateAsync({
      historyId: history.id,
      content: trimmed,
    });
    setIsEditing(false);
  }, [draft, history.id, updateMutation]);

  const handleDelete = useCallback(() => {
    if (!confirm(t("Delete this comment?"))) return;
    deleteMutation.mutate({ historyId: history.id });
  }, [deleteMutation, history.id, t]);

  return (
    <Group align="flex-start" gap="sm" wrap="nowrap">
      <CustomAvatar
        size="sm"
        avatarUrl={history.creator?.avatarUrl ?? null}
        name={creatorName}
      />
      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        <Box
          style={{
            background: "var(--mantine-color-gray-1)",
            borderRadius: 12,
            padding: "8px 12px",
            display: "inline-block",
            maxWidth: "100%",
          }}
        >
          {isDeleted ? (
            <Text size="sm" c="dimmed" fs="italic">
              {t("(deleted)")}
            </Text>
          ) : isEditing ? (
            <Stack gap="xs">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.currentTarget.value)}
                autosize
                minRows={2}
                size="sm"
              />
              <Group justify="flex-end" gap="xs">
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={handleCancelEdit}
                  disabled={updateMutation.isPending}
                >
                  {t("Cancel")}
                </Button>
                <Button
                  size="xs"
                  onClick={handleSaveEdit}
                  loading={updateMutation.isPending}
                  disabled={!draft.trim()}
                >
                  {t("Save")}
                </Button>
              </Group>
            </Stack>
          ) : isLegacyTiptapJson(history.content) ? (
            <ReviewEditor defaultContent={history.content} editable={false} />
          ) : (
            <ReviewMarkdown content={toMarkdownString(history.content)} />
          )}
        </Box>
        {!isEditing && (
          <Group gap="xs" wrap="nowrap">
            <Text size="xs" c="dimmed">
              {creatorName}
            </Text>
            <Text size="xs" c="dimmed">
              ·
            </Text>
            <Text size="xs" c="dimmed">
              {isEdited ? `${t("edited")} ${editedAtAgo}` : createdAtAgo}
            </Text>
            {isOwner && !isDeleted && (
              <>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={handleStartEdit}
                  aria-label={t("Edit")}
                >
                  <IconEdit size={12} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="xs"
                  onClick={handleDelete}
                  loading={deleteMutation.isPending}
                  aria-label={t("Delete")}
                >
                  <IconTrash size={12} />
                </ActionIcon>
              </>
            )}
          </Group>
        )}
      </Stack>
    </Group>
  );
}
