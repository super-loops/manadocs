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
  IconCopy,
  IconCrown,
  IconDots,
  IconDownload,
  IconEye,
  IconFileText,
  IconGitCompare,
  IconJson,
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
  useDuplicateVersionMutation,
  useSetPrimaryVersionMutation,
  useUndiscardVersionMutation,
} from "@/features/page-version/queries/page-version-query";
import { getPageVersionInfo } from "@/features/page-version/services/page-version-service";
import {
  downloadVersionJson,
  downloadVersionMarkdown,
} from "@/features/page-version/utils/download-version";
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
  const duplicateMutation = useDuplicateVersionMutation();
  const setPreviewVersionId = useSetAtom(previewVersionIdAtom);
  const [, setDiffSelection] = useAtom(diffSelectionAtom);

  const isDiscarded = !!version.discardedAt;
  const isMarker = version.version === 0;

  // 다운로드는 content 가 필요 — 카드는 경량이라 클릭 시 상세 fetch
  const handleDownload = async (format: "json" | "md") => {
    const full = await getPageVersionInfo(version.id);
    if (format === "json") downloadVersionJson(full);
    else downloadVersionMarkdown(full);
  };

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
                <Menu.Item
                  leftSection={<IconCopy size={14} />}
                  onClick={() => duplicateMutation.mutate(version.id)}
                >
                  {t("이 버전으로 새 페이지")}
                </Menu.Item>
                <Menu.Sub>
                  <Menu.Sub.Target>
                    <Menu.Sub.Item leftSection={<IconDownload size={14} />}>
                      {t("다운로드")}
                    </Menu.Sub.Item>
                  </Menu.Sub.Target>
                  <Menu.Sub.Dropdown>
                    <Menu.Item
                      leftSection={<IconFileText size={14} />}
                      onClick={() => handleDownload("md")}
                    >
                      Markdown (.md)
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconJson size={14} />}
                      onClick={() => handleDownload("json")}
                    >
                      JSON (.json)
                    </Menu.Item>
                  </Menu.Sub.Dropdown>
                </Menu.Sub>
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
