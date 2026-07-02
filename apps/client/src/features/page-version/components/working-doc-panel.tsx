import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconCrown,
  IconDots,
  IconPencil,
  IconPlus,
  IconRestore,
  IconTrash,
} from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { timeAgo } from "@/lib/time";
import {
  useCreateWorkingDocMutation,
  useDeleteWorkingDocMutation,
  useResetWorkingDocMutation,
  useSetPrimaryWorkingDocMutation,
  useWorkingDocsQuery,
} from "@/features/page-version/queries/page-version-query";
import { IPageWorkingDoc } from "@/features/page-version/types/page-version.types";
import { activeWorkingDocAtom } from "@/features/page-version/atoms/page-version-atoms";
import { usePageQuery } from "@/features/page/queries/page-query";
import { extractPageSlugId } from "@/lib";
import { modals } from "@mantine/modals";

const MAX_VISIBLE_AVATARS = 4;

export default function WorkingDocPanel() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });

  const pageId = page?.id;
  const canEdit = page?.permissions?.canEdit ?? false;
  const primaryWorkingDocId = page?.primaryWorkingDocId ?? null;

  const { data: workingDocs } = useWorkingDocsQuery(pageId, canEdit);
  const createMutation = useCreateWorkingDocMutation(pageId);

  if (!pageId || !canEdit) return null;

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          {t("{{count}}개의 작업문서", { count: workingDocs?.length ?? 0 })}
        </Text>
        <Button
          size="compact-xs"
          variant="subtle"
          leftSection={<IconPlus size={14} />}
          onClick={() => createMutation.mutate({ pageId })}
        >
          {t("새 작업문서")}
        </Button>
      </Group>

      {(workingDocs ?? []).map((workingDoc) => (
        <WorkingDocCard
          key={workingDoc.id}
          workingDoc={workingDoc}
          pageId={pageId}
          isPrimary={workingDoc.id === primaryWorkingDocId}
        />
      ))}
    </Stack>
  );
}

function WorkingDocCard({
  workingDoc,
  pageId,
  isPrimary,
}: {
  workingDoc: IPageWorkingDoc;
  pageId: string;
  isPrimary: boolean;
}) {
  const { t } = useTranslation();
  const [activeWorkingDoc, setActiveWorkingDoc] = useAtom(activeWorkingDocAtom);
  const setPrimaryMutation = useSetPrimaryWorkingDocMutation(pageId);
  const deleteMutation = useDeleteWorkingDocMutation(pageId);
  const resetMutation = useResetWorkingDocMutation(pageId);

  const isActive =
    activeWorkingDoc?.pageId === pageId
      ? activeWorkingDoc.workingDocId === workingDoc.id
      : isPrimary;

  const contributors = workingDoc.contributors ?? [];
  const displayName =
    workingDoc.name ||
    (workingDoc.baseVersion
      ? t("버전 {{n}}에서 시작", { n: workingDoc.baseVersion.version })
      : t("작업문서"));

  const confirmReset = () =>
    modals.openConfirmModal({
      title: t("수정취소"),
      children: (
        <Text size="sm">
          {t(
            "이 작업문서의 수정사항을 모두 되돌리고 기준 버전 내용으로 리셋합니다. 계속할까요?",
          )}
        </Text>
      ),
      labels: { confirm: t("수정취소"), cancel: t("취소") },
      confirmProps: { color: "red" },
      onConfirm: () => resetMutation.mutate(workingDoc.id),
    });

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: t("작업문서 삭제"),
      children: (
        <Text size="sm">
          {t("이 작업문서를 삭제합니다. 확정되지 않은 수정사항은 사라집니다.")}
        </Text>
      ),
      labels: { confirm: t("삭제"), cancel: t("취소") },
      confirmProps: { color: "red" },
      onConfirm: () => deleteMutation.mutate(workingDoc.id),
    });

  return (
    <Card
      withBorder
      radius="md"
      padding="sm"
      style={
        isActive
          ? {
              borderColor: "var(--mantine-color-blue-5)",
            }
          : undefined
      }
    >
      <Group justify="space-between" wrap="nowrap" mb={6}>
        <Group gap={6} wrap="nowrap">
          {isPrimary && (
            <Badge size="sm" variant="light" color="blue" radius="sm">
              Primary
            </Badge>
          )}
          <Badge size="sm" variant="light" color="yellow" radius="sm">
            {t("작업중")}
          </Badge>
        </Group>

        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" size="sm">
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {!isActive && (
              <Menu.Item
                leftSection={<IconPencil size={14} />}
                onClick={() =>
                  setActiveWorkingDoc({ pageId, workingDocId: workingDoc.id })
                }
              >
                {t("이 작업문서로 편집")}
              </Menu.Item>
            )}
            {!isPrimary && (
              <Menu.Item
                leftSection={<IconCrown size={14} />}
                onClick={() => setPrimaryMutation.mutate(workingDoc.id)}
              >
                {t("Primary 로 변경")}
              </Menu.Item>
            )}
            <Menu.Item
              leftSection={<IconRestore size={14} />}
              onClick={confirmReset}
            >
              {t("수정취소")}
            </Menu.Item>
            {!isPrimary && (
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={confirmDelete}
              >
                {t("삭제")}
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Text size="sm" fw={500} lineClamp={1}>
        {displayName}
      </Text>

      <Group gap={8} mt={8} wrap="nowrap" justify="space-between">
        <Group gap={8} wrap="nowrap">
          {contributors.length > 0 ? (
            <Tooltip.Group openDelay={300} closeDelay={100}>
              <Avatar.Group spacing={8}>
                {contributors.slice(0, MAX_VISIBLE_AVATARS).map((user) => (
                  <Tooltip key={user.id} label={user.name} withArrow>
                    <CustomAvatar
                      size="sm"
                      avatarUrl={user.avatarUrl}
                      name={user.name}
                    />
                  </Tooltip>
                ))}
                {contributors.length > MAX_VISIBLE_AVATARS && (
                  <Avatar size="sm" radius="xl">
                    +{contributors.length - MAX_VISIBLE_AVATARS}
                  </Avatar>
                )}
              </Avatar.Group>
            </Tooltip.Group>
          ) : (
            workingDoc.creator && (
              <CustomAvatar
                size="sm"
                avatarUrl={workingDoc.creator.avatarUrl}
                name={workingDoc.creator.name}
              />
            )
          )}
        </Group>
        <Text size="xs" c="dimmed">
          {timeAgo(new Date(workingDoc.updatedAt))}
        </Text>
      </Group>
    </Card>
  );
}
