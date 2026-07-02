import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Stack,
  Text,
} from "@mantine/core";
import {
  IconCrown,
  IconDots,
  IconEye,
  IconGitCompare,
  IconRestore,
  IconTrashX,
} from "@tabler/icons-react";
import { useAtom, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { timeAgo } from "@/lib/time";
import {
  usePageVersionsQuery,
  useDiscardVersionMutation,
  useSetPrimaryVersionMutation,
  useUndiscardVersionMutation,
} from "@/features/page-version/queries/page-version-query";
import { IPageVersion } from "@/features/page-version/types/page-version.types";
import {
  diffSelectionAtom,
  previewVersionIdAtom,
} from "@/features/page-version/atoms/page-version-atoms";
import { usePageQuery } from "@/features/page/queries/page-query";
import { extractPageSlugId } from "@/lib";
import { useParams } from "react-router-dom";

export default function VersionPanel() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });

  const pageId = page?.id;
  const canEdit = page?.permissions?.canEdit ?? false;
  const primaryVersionId = page?.primaryVersionId ?? null;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePageVersionsQuery(pageId);

  const versions: IPageVersion[] =
    data?.pages?.flatMap((p) => p.items) ?? [];

  if (!pageId) return null;

  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed">
        {t("{{count}}개의 버전", { count: versions.length })}
      </Text>

      {versions.map((version) => (
        <VersionCard
          key={version.id}
          version={version}
          pageId={pageId}
          isPrimary={version.id === primaryVersionId}
          canEdit={canEdit}
        />
      ))}

      {hasNextPage && (
        <Button
          variant="subtle"
          size="xs"
          loading={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {t("더 보기")}
        </Button>
      )}
    </Stack>
  );
}

function VersionCard({
  version,
  pageId,
  isPrimary,
  canEdit,
}: {
  version: IPageVersion;
  pageId: string;
  isPrimary: boolean;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const setPrimaryMutation = useSetPrimaryVersionMutation(pageId);
  const discardMutation = useDiscardVersionMutation(pageId);
  const undiscardMutation = useUndiscardVersionMutation(pageId);
  const setPreviewVersionId = useSetAtom(previewVersionIdAtom);
  const [, setDiffSelection] = useAtom(diffSelectionAtom);

  const isDiscarded = !!version.discardedAt;
  const isMarker = version.version === 0;

  return (
    <Card
      withBorder
      radius="md"
      padding="sm"
      style={
        isPrimary
          ? {
              borderColor: "var(--mantine-color-blue-5)",
              backgroundColor: "var(--mantine-color-blue-0)",
            }
          : isDiscarded
            ? { backgroundColor: "var(--mantine-color-gray-0)" }
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
          {isDiscarded && (
            <Badge size="sm" variant="light" color="gray" radius="sm">
              {t("폐기됨")}
            </Badge>
          )}
        </Group>

        <Group gap={4} wrap="nowrap">
          <Text size="sm" fw={500} c={isDiscarded ? "dimmed" : undefined}>
            {isMarker ? t("버전 0 · 초기") : t("버전 {{n}}", { n: version.version })}
          </Text>

          {canEdit && !isMarker && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="sm">
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {!isDiscarded && !isPrimary && (
                  <Menu.Item
                    leftSection={<IconCrown size={14} />}
                    onClick={() => setPrimaryMutation.mutate(version.id)}
                  >
                    {t("Primary 로 변경")}
                  </Menu.Item>
                )}
                <Menu.Item
                  leftSection={<IconEye size={14} />}
                  onClick={() => setPreviewVersionId(version.id)}
                >
                  {t("미리보기")}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconGitCompare size={14} />}
                  onClick={() =>
                    setDiffSelection({
                      pageId,
                      leftVersionId: null,
                      rightVersionId: version.id,
                    })
                  }
                >
                  {t("비교(DIFF)")}
                </Menu.Item>
                {!isDiscarded ? (
                  <Menu.Item
                    color="red"
                    leftSection={<IconTrashX size={14} />}
                    onClick={() => discardMutation.mutate(version.id)}
                  >
                    {t("폐기")}
                  </Menu.Item>
                ) : (
                  <Menu.Item
                    leftSection={<IconRestore size={14} />}
                    onClick={() => undiscardMutation.mutate(version.id)}
                  >
                    {t("폐기 해제")}
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Group>

      <Text
        size="sm"
        lineClamp={2}
        td={isDiscarded ? "line-through" : undefined}
        c={isDiscarded ? "dimmed" : undefined}
      >
        {version.message || t("(메시지 없음)")}
      </Text>

      <Group gap={8} mt={8} wrap="nowrap">
        {version.creator && (
          <>
            <CustomAvatar
              size={24}
              avatarUrl={version.creator.avatarUrl}
              name={version.creator.name}
            />
            <Text size="xs" c="dimmed">
              {version.creator.name} ·{" "}
              {timeAgo(new Date(version.createdAt))}
            </Text>
          </>
        )}
      </Group>
    </Card>
  );
}
