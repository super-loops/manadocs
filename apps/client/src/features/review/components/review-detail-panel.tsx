import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconArrowUp,
  IconBookmark,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import { useAtomValue, useSetAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useAddReviewCommentMutation,
  useChangeReviewStatusMutation,
  useDeleteReviewAnchorMutation,
  useReviewQuery,
  useUpdateReviewAssigneesMutation,
  useUpdateReviewMutation,
} from "@/features/review/queries/review-query";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query";
import { selectedReviewIdAtom } from "@/features/review/atoms/review-atom";
import {
  IReviewAssignee,
  IReviewHistory,
  REVIEW_LIST_ICON,
  REVIEW_STATUS_ABBREV,
  REVIEW_STATUS_LABEL,
  ReviewStatus,
  reviewAnchorLabel,
  reviewSidebarLabel,
} from "@/features/review/types/review.types";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { MultiUserSelect } from "@/features/group/components/multi-user-select";
import { buildPageUrl } from "@/features/page/page.utils";
import { useTimeAgo } from "@/hooks/use-time-ago";
import ReviewStatusBadge from "./review-status-badge";
import ReviewCommentBubble from "./review-comment-bubble";
import ReviewMarkdown from "./review-markdown";
import { scrollToReviewAnchor } from "@/features/review/utils/review-anchor-scroll";
import { REVIEW_DRAG_MIME } from "@/features/editor/components/review/review-anchor-drop-zone";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";

const TAB_ICON = {
  evidence: "🧾",
  assignees: "👥",
  anchors: REVIEW_LIST_ICON, // ⚓
} as const;

function assigneeLabel(a: IReviewAssignee): string {
  return a.user?.name || a.group?.name || "?";
}

function toMarkdownString(content: any): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  return "";
}

interface ReviewDetailPanelProps {
  reviewId: string;
}

export default function ReviewDetailPanel({ reviewId }: ReviewDetailPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSelectedReviewId = useSetAtom(selectedReviewIdAtom);
  const pageEditor = useAtomValue(pageEditorAtom);
  const { pageSlug } = useParams();
  const { data: currentPage } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const { data: review, isLoading } = useReviewQuery(reviewId);
  const changeStatusMutation = useChangeReviewStatusMutation();
  const updateAssigneesMutation = useUpdateReviewAssigneesMutation();
  const addCommentMutation = useAddReviewCommentMutation();
  const updateReviewMutation = useUpdateReviewMutation();
  const deleteAnchorMutation = useDeleteReviewAnchorMutation(currentPage?.id);

  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [hideStatusChanges, setHideStatusChanges] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("evidence");

  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [contentEditing, setContentEditing] = useState(false);
  const [contentDraft, setContentDraft] = useState("");

  useEffect(() => {
    if (review) {
      setTitleDraft(review.title ?? "");
      setContentDraft(toMarkdownString(review.content));
    }
  }, [review?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusOptions = useMemo(
    () =>
      (Object.keys(REVIEW_STATUS_LABEL) as ReviewStatus[]).map((s) => ({
        value: s,
        label: `${REVIEW_STATUS_ABBREV[s]} - ${t(REVIEW_STATUS_LABEL[s])}`,
      })),
    [t],
  );

  const handleChangeStatus = useCallback(
    (value: string | null) => {
      if (!value || !review) return;
      const nextStatus = value as ReviewStatus;
      changeStatusMutation.mutate(
        { reviewId: review.id, status: nextStatus },
        {
          onSuccess: () => {
            if (!pageEditor || pageEditor.isDestroyed) return;
            try {
              const tr = pageEditor.state.tr;
              let changed = false;
              pageEditor.state.doc.descendants((node, pos) => {
                if (
                  node.type.name === "reviewAnchor" &&
                  node.attrs.reviewId === review.id &&
                  node.attrs.status !== nextStatus
                ) {
                  tr.setNodeAttribute(pos, "status", nextStatus);
                  changed = true;
                }
                return true;
              });
              if (changed) pageEditor.view.dispatch(tr);
            } catch {
              // editor 정리 중이면 무시
            }
          },
        },
      );
    },
    [changeStatusMutation, review, pageEditor],
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
      setAssigneePickerOpen(false);
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

  const handleSaveTitle = useCallback(async () => {
    if (!review) return;
    await updateReviewMutation.mutateAsync({
      reviewId: review.id,
      title: titleDraft,
    });
    setTitleEditing(false);
  }, [review, titleDraft, updateReviewMutation]);

  const handleSaveContent = useCallback(async () => {
    if (!review) return;
    await updateReviewMutation.mutateAsync({
      reviewId: review.id,
      content: contentDraft,
    });
    setContentEditing(false);
  }, [review, contentDraft, updateReviewMutation]);

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
  const allHistories = [...(review.histories ?? [])].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const evidenceVisible = hideStatusChanges
    ? allHistories.filter((h) => h.type !== "status")
    : allHistories;

  // 카운트는 항상 코멘트만 (status 변경 제외)
  const evidenceCount = allHistories.filter((h) => h.type !== "status").length;
  const assigneesCount = assignees.length;
  const anchorsCount = anchors.length;

  const titleText = (review.title ?? "").trim();
  const contentText = toMarkdownString(review.content).trim();

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" wrap="nowrap" align="center">
        <Group gap="xs" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={() => setSelectedReviewId(null)}
            aria-label={t("Back to list")}
          >
            <IconArrowLeft size={16} />
          </ActionIcon>
          <Text fw={600} size="md">
            {reviewSidebarLabel(review.sequenceId)}
          </Text>
          <ReviewStatusBadge status={review.status} format="abbrev" />
        </Group>
      </Group>

      <Select
        data={statusOptions}
        value={review.status}
        onChange={handleChangeStatus}
        allowDeselect={false}
        size="xs"
      />

      <Divider />

      {/* 타이틀: 평소엔 텍스트 자체가 클릭 영역, 클릭 시 인라인 TextInput */}
      <Stack gap={2}>
        {titleEditing ? (
          <Stack gap="xs">
            <TextInput
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.currentTarget.value)}
              placeholder={t("Title")}
              size="sm"
              autoFocus
            />
            <Group justify="flex-end" gap="xs">
              <Button
                size="xs"
                variant="subtle"
                onClick={() => {
                  setTitleEditing(false);
                  setTitleDraft(review.title ?? "");
                }}
              >
                {t("Cancel")}
              </Button>
              <Button
                size="xs"
                onClick={handleSaveTitle}
                loading={updateReviewMutation.isPending}
              >
                {t("Save")}
              </Button>
            </Group>
          </Stack>
        ) : (
          <Box
            onClick={() => setTitleEditing(true)}
            style={{ cursor: "text" }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") setTitleEditing(true);
            }}
          >
            {titleText ? (
              <Text fw={600} size="lg">
                {titleText}
              </Text>
            ) : (
              <Text size="md" c="dimmed" fs="italic">
                {t("Click to add title...")}
              </Text>
            )}
          </Box>
        )}

        {/* 본문: 동일하게 텍스트 자체가 클릭 영역 */}
        {contentEditing ? (
          <Stack gap="xs" mt="xs">
            <Textarea
              value={contentDraft}
              onChange={(e) => setContentDraft(e.currentTarget.value)}
              autosize
              minRows={3}
              size="sm"
              placeholder={t("Description (markdown supported)")}
              autoFocus
            />
            <Group justify="flex-end" gap="xs">
              <Button
                size="xs"
                variant="subtle"
                onClick={() => {
                  setContentEditing(false);
                  setContentDraft(toMarkdownString(review.content));
                }}
              >
                {t("Cancel")}
              </Button>
              <Button
                size="xs"
                onClick={handleSaveContent}
                loading={updateReviewMutation.isPending}
              >
                {t("Save")}
              </Button>
            </Group>
          </Stack>
        ) : (
          <Box
            onClick={() => setContentEditing(true)}
            style={{ cursor: "text", minHeight: "1em" }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") setContentEditing(true);
            }}
          >
            {contentText ? (
              <>
                <ReviewMarkdown content={contentText} />
                <Text size="xs" c="dimmed" fs="italic" mt={4}>
                  {t("Click to edit")}
                </Text>
              </>
            ) : (
              <Text size="sm" c="dimmed" fs="italic">
                {t("Click to add description...")}
              </Text>
            )}
          </Box>
        )}
      </Stack>

      <Divider />

      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value || "evidence")}
        variant="default"
      >
        <Tabs.List>
          <Tabs.Tab
            value="evidence"
            rightSection={
              <Badge size="xs" color="gray" variant="light">
                {evidenceCount}
              </Badge>
            }
          >
            {TAB_ICON.evidence} {t("Evidence")}
          </Tabs.Tab>
          <Tabs.Tab
            value="assignees"
            rightSection={
              <Badge size="xs" color="gray" variant="light">
                {assigneesCount}
              </Badge>
            }
          >
            {TAB_ICON.assignees} {t("Assignees")}
          </Tabs.Tab>
          <Tabs.Tab
            value="anchors"
            rightSection={
              <Badge size="xs" color="gray" variant="light">
                {anchorsCount}
              </Badge>
            }
          >
            {TAB_ICON.anchors} {t("Anchors")}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="evidence" pt="sm">
          <Stack gap="xs">
            <Group justify="flex-end" wrap="nowrap">
              <Checkbox
                size="xs"
                label={t("Hide status changes")}
                checked={hideStatusChanges}
                onChange={(e) =>
                  setHideStatusChanges(e.currentTarget.checked)
                }
              />
            </Group>
            {evidenceVisible.length === 0 ? (
              <Text size="xs" c="dimmed">
                {t("No evidence yet")}
              </Text>
            ) : (
              <Stack gap="sm">
                {evidenceVisible.map((h) => (
                  <HistoryEntry
                    key={h.id}
                    history={h}
                    reviewId={review.id}
                  />
                ))}
              </Stack>
            )}

            <Divider my="xs" />

            <ReviewCommentInput
              isSending={addCommentMutation.isPending}
              onSend={(content) =>
                addCommentMutation.mutateAsync({
                  reviewId: review.id,
                  content,
                })
              }
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="assignees" pt="sm">
          <Stack gap="xs">
            <Group justify="flex-end" wrap="nowrap">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setAssigneePickerOpen((v) => !v)}
                aria-label={t("Add assignees")}
                aria-expanded={assigneePickerOpen}
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Group>
            {assignees.length > 0 ? (
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
            ) : (
              <Text size="xs" c="dimmed">
                {t("None")}
              </Text>
            )}
            {assigneePickerOpen && (
              <MultiUserSelect
                label={t("Add assignees")}
                onChange={handleAddAssignees}
              />
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="anchors" pt="sm">
          <Stack gap="xs">
            <Group justify="flex-end" wrap="nowrap">
              <Badge
                variant="light"
                color="gray"
                size="sm"
                leftSection={<IconBookmark size={12} />}
                style={{ cursor: "grab", userSelect: "none" }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(REVIEW_DRAG_MIME, review.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                title={t("Drag to add a new anchor in the document")}
              >
                {t("Drag to add")}
              </Badge>
            </Group>
            {anchors.length === 0 ? (
              <Text size="xs" c="dimmed">
                {t("No anchors")}
              </Text>
            ) : (
              <Stack gap={4}>
                {anchors.map((anchor) => {
                  const page = anchor.page;
                  const to = page
                    ? buildPageUrl(
                        undefined,
                        page.slugId,
                        page.title ?? undefined,
                      )
                    : null;
                  const isCurrentPage =
                    !!currentPage?.id && currentPage.id === anchor.pageId;
                  const handleAnchorClick = () => {
                    if (isCurrentPage) {
                      // 같은 페이지: 즉시 시도, 못 찾으면 orphan 정리
                      if (scrollToReviewAnchor(anchor.id)) return;
                      deleteAnchorMutation.mutate({ anchorId: anchor.id });
                      return;
                    }
                    // 다른 페이지: 이동 후 page.tsx의 useEffect가 cleanup 처리
                    if (to)
                      navigate(to, {
                        state: {
                          anchorId: anchor.id,
                          autoCleanup: true,
                        },
                      });
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
                        {reviewAnchorLabel(
                          review.sequenceId,
                          anchor.sequenceId,
                        )}
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
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

interface HistoryEntryProps {
  history: IReviewHistory;
  reviewId: string;
}

function HistoryEntry({ history, reviewId }: HistoryEntryProps) {
  const { t } = useTranslation();
  const createdAtAgo = useTimeAgo(history.createdAt);
  const creatorName = history.creator?.name || t("Unknown");

  if (history.type === "status") {
    const from = history.oldStatus
      ? t(REVIEW_STATUS_LABEL[history.oldStatus])
      : "—";
    const to = history.newStatus
      ? t(REVIEW_STATUS_LABEL[history.newStatus])
      : "—";
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

  return <ReviewCommentBubble history={history} reviewId={reviewId} />;
}

interface ReviewCommentInputProps {
  isSending: boolean;
  onSend: (content: string) => Promise<unknown>;
}

function ReviewCommentInput({ isSending, onSend }: ReviewCommentInputProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");

  const handleSave = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    await onSend(trimmed);
    setContent("");
  }, [content, onSend]);

  const hasContent = !!content.trim();

  return (
    <Box>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        autosize
        minRows={2}
        placeholder={t("Add a comment... (markdown supported)")}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
        }}
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
