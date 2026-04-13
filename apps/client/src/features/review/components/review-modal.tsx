import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { IconArrowUp, IconBookmark, IconX } from "@tabler/icons-react";
import { useAtom, useSetAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useAddReviewCommentMutation,
  useChangeReviewStatusMutation,
  useReviewQuery,
  useUpdateReviewAssigneesMutation,
} from "@/features/review/queries/review-query";
import { openReviewModalAtom } from "@/features/review/atoms/review-atom";
import {
  IReviewAssignee,
  IReviewHistory,
  ReviewStatus,
} from "@/features/review/types/review.types";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { MultiUserSelect } from "@/features/group/components/multi-user-select";
import CommentEditor from "@/features/comment/components/comment-editor";
import { buildPageUrl } from "@/features/page/page.utils";
import { useTimeAgo } from "@/hooks/use-time-ago";
import ReviewStatusBadge from "./review-status-badge";

const STATUS_LABEL: Record<ReviewStatus, string> = {
  open: "Open",
  progress: "In Progress",
  resolved: "Resolved",
};

function assigneeLabel(a: IReviewAssignee): string {
  return a.user?.name || a.group?.name || "?";
}

export default function ReviewModal() {
  const [reviewId, setReviewId] = useAtom(openReviewModalAtom);
  const opened = !!reviewId;

  return (
    <Modal
      opened={opened}
      onClose={() => setReviewId(null)}
      title={null}
      withCloseButton={false}
      size="lg"
      padding="md"
    >
      {reviewId && <ReviewModalContent reviewId={reviewId} />}
    </Modal>
  );
}

interface ReviewModalContentProps {
  reviewId: string;
}

function ReviewModalContent({ reviewId }: ReviewModalContentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setOpenReview = useSetAtom(openReviewModalAtom);
  const { data: review, isLoading } = useReviewQuery(reviewId);
  const changeStatusMutation = useChangeReviewStatusMutation();
  const updateAssigneesMutation = useUpdateReviewAssigneesMutation();
  const addCommentMutation = useAddReviewCommentMutation();

  const statusOptions = useMemo(
    () =>
      (Object.keys(STATUS_LABEL) as ReviewStatus[]).map((s) => ({
        value: s,
        label: t(STATUS_LABEL[s]),
      })),
    [t],
  );

  const handleChangeStatus = useCallback(
    (value: string | null) => {
      if (!value || !review) return;
      changeStatusMutation.mutate({
        reviewId: review.id,
        status: value as ReviewStatus,
      });
    },
    [changeStatusMutation, review],
  );

  const handleAddAssignees = useCallback(
    (userIds: string[]) => {
      if (!review || userIds.length === 0) return;
      const existingUserIds = (review.assignees ?? [])
        .map((a) => a.userId)
        .filter((x): x is string => !!x);
      const merged = Array.from(new Set([...existingUserIds, ...userIds]));
      const existingGroupIds = (review.assignees ?? [])
        .map((a) => a.groupId)
        .filter((x): x is string => !!x);
      updateAssigneesMutation.mutate({
        reviewId: review.id,
        assigneeUserIds: merged,
        assigneeGroupIds: existingGroupIds,
      });
    },
    [review, updateAssigneesMutation],
  );

  const handleRemoveAssignee = useCallback(
    (assignee: IReviewAssignee) => {
      if (!review) return;
      const userIds = (review.assignees ?? [])
        .filter((a) => a.id !== assignee.id)
        .map((a) => a.userId)
        .filter((x): x is string => !!x);
      const groupIds = (review.assignees ?? [])
        .filter((a) => a.id !== assignee.id)
        .map((a) => a.groupId)
        .filter((x): x is string => !!x);
      updateAssigneesMutation.mutate({
        reviewId: review.id,
        assigneeUserIds: userIds,
        assigneeGroupIds: groupIds,
      });
    },
    [review, updateAssigneesMutation],
  );

  if (isLoading || !review) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed">
          {t("Loading...")}
        </Text>
      </Box>
    );
  }

  const assignees = review.assignees ?? [];
  const anchors = review.anchors ?? [];
  const histories = [...(review.histories ?? [])].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap="xs" wrap="nowrap">
          <Text fw={600} size="lg">
            #RE_{review.sequenceId}
          </Text>
          <ReviewStatusBadge status={review.status} />
        </Group>
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={() => setOpenReview(null)}
          aria-label={t("Close")}
        >
          <IconX size={18} />
        </ActionIcon>
      </Group>

      <Group gap="sm" wrap="nowrap">
        <Select
          data={statusOptions}
          value={review.status}
          onChange={handleChangeStatus}
          allowDeselect={false}
          size="xs"
          w={160}
        />
      </Group>

      <Divider />

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          {t("Assignees")}
        </Text>
        {assignees.length > 0 && (
          <Group gap="xs">
            {assignees.map((a) => (
              <Badge
                key={a.id}
                variant="light"
                color="gray"
                size="lg"
                leftSection={
                  <CustomAvatar
                    size={16}
                    avatarUrl={a.user?.avatarUrl ?? null}
                    name={assigneeLabel(a)}
                  />
                }
                rightSection={
                  <ActionIcon
                    variant="transparent"
                    size="xs"
                    onClick={() => handleRemoveAssignee(a)}
                    aria-label={t("Remove")}
                  >
                    <IconX size={12} />
                  </ActionIcon>
                }
              >
                {assigneeLabel(a)}
              </Badge>
            ))}
          </Group>
        )}
        <MultiUserSelect
          label={t("Add assignees")}
          onChange={handleAddAssignees}
        />
      </Stack>

      <Divider />

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          {t("Anchors")}
        </Text>
        {anchors.length === 0 ? (
          <Text size="xs" c="dimmed">
            {t("No anchors")}
          </Text>
        ) : (
          <Stack gap={4}>
            {anchors.map((anchor) => {
              const page = anchor.page;
              const to = page
                ? buildPageUrl(undefined, page.slugId, page.title ?? undefined)
                : null;
              const handleAnchorClick = () => {
                if (to) {
                  setOpenReview(null);
                  navigate(to);
                }
              };
              return (
                <Group
                  key={anchor.id}
                  gap="xs"
                  wrap="nowrap"
                  onClick={handleAnchorClick}
                  style={{ cursor: to ? "pointer" : "default" }}
                >
                  <IconBookmark size={14} stroke={1.5} />
                  <Badge variant="light" size="sm" color="gray">
                    #AC_{anchor.sequenceId}
                  </Badge>
                  <Text size="sm" lineClamp={1}>
                    {page?.title || t("untitled")}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        )}
      </Stack>

      <Divider />

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          {t("History")}
        </Text>
        {histories.length === 0 ? (
          <Text size="xs" c="dimmed">
            {t("No history yet")}
          </Text>
        ) : (
          <Stack gap="sm">
            {histories.map((h) => (
              <HistoryEntry key={h.id} history={h} />
            ))}
          </Stack>
        )}
      </Stack>

      <Divider />

      <ReviewCommentInput
        reviewId={review.id}
        isSending={addCommentMutation.isPending}
        onSend={(content) =>
          addCommentMutation.mutateAsync({ reviewId: review.id, content })
        }
      />
    </Stack>
  );
}

function HistoryEntry({ history }: { history: IReviewHistory }) {
  const { t } = useTranslation();
  const createdAtAgo = useTimeAgo(history.createdAt);
  const creatorName = history.creator?.name || t("Unknown");

  if (history.type === "status") {
    const from = history.oldStatus
      ? t(STATUS_LABEL[history.oldStatus])
      : "—";
    const to = history.newStatus ? t(STATUS_LABEL[history.newStatus]) : "—";
    return (
      <Text size="xs" c="dimmed">
        {t("{{name}} changed status from {{from}} to {{to}}", {
          name: creatorName,
          from,
          to,
        })}{" "}
        · {createdAtAgo}
      </Text>
    );
  }

  return (
    <Group align="flex-start" gap="sm" wrap="nowrap">
      <CustomAvatar
        size="sm"
        avatarUrl={history.creator?.avatarUrl ?? null}
        name={creatorName}
      />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Group gap="xs">
          <Text size="sm" fw={500}>
            {creatorName}
          </Text>
          <Text size="xs" c="dimmed">
            {createdAtAgo}
          </Text>
        </Group>
        {history.content ? (
          <CommentEditor defaultContent={history.content} editable={false} />
        ) : null}
      </Box>
    </Group>
  );
}

interface ReviewCommentInputProps {
  reviewId: string;
  isSending: boolean;
  onSend: (content: any) => Promise<unknown>;
}

function ReviewCommentInput({ isSending, onSend }: ReviewCommentInputProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState<any>(null);
  const editorRef = useRef<any>(null);

  const handleSave = useCallback(async () => {
    if (!content) return;
    await onSend(content);
    setContent(null);
    editorRef.current?.clearContent();
  }, [content, onSend]);

  const hasContent = !!content;

  return (
    <Box>
      <CommentEditor
        ref={editorRef}
        onUpdate={setContent}
        onSave={handleSave}
        editable={true}
        placeholder={t("Add a comment...")}
      />
      <Group justify="flex-end" mt="xs">
        <Button
          size="xs"
          onClick={handleSave}
          disabled={!hasContent}
          loading={isSending}
          leftSection={<IconArrowUp size={14} />}
        >
          {t("Send")}
        </Button>
      </Group>
    </Box>
  );
}
