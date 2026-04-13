import {
  Text,
  Tabs,
  Space,
  Stack,
  Group,
  Center,
  Loader,
  UnstyledButton,
} from "@mantine/core";
import {
  IconClockHour3,
  IconMessageCircle,
  IconMessageCheck,
} from "@tabler/icons-react";
import RecentChanges from "@/components/common/recent-changes.tsx";
import { useTranslation } from "react-i18next";
import { useAssignedReviewsQuery } from "@/features/review/queries/review-query";
import { IReview, ReviewStatus } from "@/features/review/types/review.types";
import { useSetAtom } from "jotai";
import { openReviewModalAtom } from "@/features/review/atoms/review-atom";
import { formatRelativeTime } from "@/features/notification/notification.utils";

function AssignedReviewsList({ statuses }: { statuses: ReviewStatus[] }) {
  const { t } = useTranslation();
  const { data, isLoading } = useAssignedReviewsQuery(statuses);
  const setOpenReviewModal = useSetAtom(openReviewModalAtom);

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  const items = data?.items ?? [];
  const isResolved = statuses.includes("resolved");

  if (items.length === 0) {
    return (
      <Center py="xl">
        <Text size="sm" c="dimmed">
          {isResolved ? t("No resolved reviews") : t("No assigned reviews")}
        </Text>
      </Center>
    );
  }

  return (
    <Stack gap={0}>
      {items.map((review: IReview) => (
        <UnstyledButton
          key={review.id}
          onClick={() => setOpenReviewModal(review.id)}
          p="sm"
          style={{
            borderRadius: 6,
          }}
        >
          <Group wrap="nowrap" align="flex-start" gap="sm">
            {review.status === "resolved" ? (
              <IconMessageCheck size={18} stroke={1.5} />
            ) : (
              <IconMessageCircle size={18} stroke={1.5} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={500} lineClamp={1}>
                {review.title || t("Untitled review")}
              </Text>
              <Group gap={6} mt={2}>
                <Text size="xs" c="dimmed">
                  {review.status === "open"
                    ? t("Open")
                    : review.status === "progress"
                      ? t("In progress")
                      : t("Resolved")}
                </Text>
                <Text size="xs" c="dimmed">
                  ·
                </Text>
                <Text size="xs" c="dimmed">
                  {formatRelativeTime(String(review.updatedAt))}
                </Text>
              </Group>
            </div>
          </Group>
        </UnstyledButton>
      ))}
    </Stack>
  );
}

export default function HomeTabs() {
  const { t } = useTranslation();

  return (
    <Tabs defaultValue="recent">
      <Tabs.List>
        <Tabs.Tab value="recent" leftSection={<IconClockHour3 size={18} />}>
          <Text size="sm" fw={500}>
            {t("Recently updated")}
          </Text>
        </Tabs.Tab>
        <Tabs.Tab
          value="assigned-reviews"
          leftSection={<IconMessageCircle size={18} />}
        >
          <Text size="sm" fw={500}>
            {t("Assigned reviews")}
          </Text>
        </Tabs.Tab>
        <Tabs.Tab
          value="resolved-reviews"
          leftSection={<IconMessageCheck size={18} />}
        >
          <Text size="sm" fw={500}>
            {t("Resolved reviews")}
          </Text>
        </Tabs.Tab>
      </Tabs.List>

      <Space my="md" />

      <Tabs.Panel value="recent">
        <RecentChanges />
      </Tabs.Panel>

      <Tabs.Panel value="assigned-reviews">
        <AssignedReviewsList statuses={["open", "progress"]} />
      </Tabs.Panel>

      <Tabs.Panel value="resolved-reviews">
        <AssignedReviewsList statuses={["resolved"]} />
      </Tabs.Panel>
    </Tabs>
  );
}
