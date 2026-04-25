import {
  Avatar,
  Badge,
  Card,
  Center,
  Drawer,
  Group,
  ScrollArea,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { IconBookmark, IconMessageOff } from "@tabler/icons-react";
import { useAtom, useSetAtom } from "jotai";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  reviewSidebarOpenAtom,
  reviewSidebarTabAtom,
  selectedReviewIdAtom,
} from "@/features/review/atoms/review-atom";
import { useReviewsByPageQuery } from "@/features/review/queries/review-query";
import {
  IReview,
  IReviewAssignee,
  ReviewStatus,
} from "@/features/review/types/review.types";
import { usePageQuery } from "@/features/page/queries/page-query";
import { extractPageSlugId } from "@/lib";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import ReviewStatusBadge from "./review-status-badge";
import ReviewDetailPanel from "./review-detail-panel";

function extractPreviewText(value: any, limit = 200): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.text === "string") return value.text;
  const content = value.content;
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const child of content) {
    if (out.length > 0 && child?.type && child.type !== "text") {
      out += " ";
    }
    out += extractPreviewText(child, limit);
    if (out.length >= limit) break;
  }
  return out;
}

function assigneeName(a: IReviewAssignee): string {
  return a.user?.name || a.group?.name || "?";
}

interface ReviewListForStatusProps {
  pageId: string | undefined;
  status: ReviewStatus;
}

function ReviewListForStatus({ pageId, status }: ReviewListForStatusProps) {
  const { t } = useTranslation();
  const setSelectedReviewId = useSetAtom(selectedReviewIdAtom);
  const { data, isLoading } = useReviewsByPageQuery(pageId, status);

  if (!pageId || isLoading) {
    return null;
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <Center py="xl">
        <Stack align="center" gap="xs">
          <IconMessageOff
            size={32}
            stroke={1.5}
            color="var(--mantine-color-dimmed)"
          />
          <Text size="sm" c="dimmed">
            {t("No reviews")}
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="xs" p="xs">
      {items.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          onClick={() => setSelectedReviewId(review.id)}
        />
      ))}
    </Stack>
  );
}

interface ReviewCardProps {
  review: IReview;
  onClick: () => void;
}

function ReviewCard({ review, onClick }: ReviewCardProps) {
  const preview = extractPreviewText(review.content).slice(0, 80).trim();
  const assignees = review.assignees ?? [];
  const visibleAssignees = assignees.slice(0, 3);
  const overflow = Math.max(0, assignees.length - visibleAssignees.length);
  const anchorCount = review.anchorCount ?? review.anchors?.length ?? 0;

  return (
    <Card
      withBorder
      radius="md"
      p="sm"
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Badge variant="light" color="gray" size="sm">
            #RE_{review.sequenceId}
          </Badge>
          <ReviewStatusBadge status={review.status} />
        </Group>
        <Group gap={4} wrap="nowrap">
          <IconBookmark size={14} stroke={1.5} />
          <Text size="xs" c="dimmed">
            {anchorCount}
          </Text>
        </Group>
      </Group>

      {preview && (
        <Text mt="xs" size="sm" lineClamp={2}>
          {preview}
        </Text>
      )}

      {assignees.length > 0 && (
        <Avatar.Group mt="xs">
          {visibleAssignees.map((a) => (
            <CustomAvatar
              key={a.id}
              size="sm"
              avatarUrl={a.user?.avatarUrl ?? null}
              name={assigneeName(a)}
            />
          ))}
          {overflow > 0 && (
            <Avatar size="sm" radius="xl">
              +{overflow}
            </Avatar>
          )}
        </Avatar.Group>
      )}
    </Card>
  );
}

export default function ReviewSidebar() {
  const { t } = useTranslation();
  const [opened, setOpened] = useAtom(reviewSidebarOpenAtom);
  const [tab, setTab] = useAtom(reviewSidebarTabAtom);
  const [selectedReviewId, setSelectedReviewId] = useAtom(selectedReviewIdAtom);
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });

  const handleClose = () => {
    setSelectedReviewId(null);
    setOpened(false);
  };

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      position="right"
      size="md"
      padding={selectedReviewId ? 0 : "md"}
      title={selectedReviewId ? null : t("Reviews")}
      withCloseButton={!selectedReviewId}
    >
      {selectedReviewId ? (
        <ScrollArea h="100%" scrollbarSize={5} type="scroll">
          <ReviewDetailPanel reviewId={selectedReviewId} />
        </ScrollArea>
      ) : (
        <Tabs
          value={tab}
          onChange={(value) => setTab((value as ReviewStatus) || "open")}
          variant="default"
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <Tabs.List>
            <Tabs.Tab value="open">{t("Open")}</Tabs.Tab>
            <Tabs.Tab value="progress">{t("In Progress")}</Tabs.Tab>
            <Tabs.Tab value="resolved">{t("Resolved")}</Tabs.Tab>
          </Tabs.List>

          <ScrollArea
            style={{ flex: "1 1 auto" }}
            scrollbarSize={5}
            type="scroll"
          >
            <Tabs.Panel value="open">
              <ReviewListForStatus pageId={page?.id} status="open" />
            </Tabs.Panel>
            <Tabs.Panel value="progress">
              <ReviewListForStatus pageId={page?.id} status="progress" />
            </Tabs.Panel>
            <Tabs.Panel value="resolved">
              <ReviewListForStatus pageId={page?.id} status="resolved" />
            </Tabs.Panel>
          </ScrollArea>
        </Tabs>
      )}
    </Drawer>
  );
}
