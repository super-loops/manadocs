import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconAlertTriangle,
  IconChecks,
  IconExternalLink,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSpaceMaintenanceScanQuery } from "@/features/space/queries/space-insight-query.ts";
import { useRemovePageMutation } from "@/features/page/queries/page-query.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { formattedDate } from "@/lib/time.ts";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import {
  IMaintenanceGroup,
  IMaintenancePage,
  MaintenanceIssueKind,
} from "@/features/space/types/space-maintenance.types.ts";
import { queryClient } from "@/main.tsx";

interface Props {
  spaceId: string;
  spaceSlug: string;
}

/** 그룹당 서버가 돌려주는 상한 — UI 안내 문구에 쓴다 */
const GROUP_ITEM_CAP = 100;

function useGroupCopy() {
  const { t } = useTranslation();

  return (kind: MaintenanceIssueKind, staleDays: number) => {
    switch (kind) {
      case "empty":
        return {
          title: t("빈 페이지"),
          description: t("제목도 내용도 없는 페이지입니다."),
        };
      case "untitled":
        return {
          title: t("제목 없는 페이지"),
          description: t("내용은 있는데 제목이 비어 있는 페이지입니다."),
        };
      case "staleUncommitted":
        return {
          title: t("장기 미확정 페이지"),
          description: t(
            "확정본이 없고 {{days}}일 넘게 수정되지 않은 페이지입니다.",
            { days: staleDays },
          ),
        };
      case "integrity":
      default:
        return {
          title: t("데이터 이상"),
          description: t(
            "버전·작업문서 연결이 어긋난 페이지입니다. 정리 전에 내용을 먼저 확인하세요.",
          ),
        };
    }
  };
}

function integrityDetailLabel(detail: string | undefined, t: any) {
  if (!detail) return null;
  const labels: Record<string, string> = {
    orphanVersions: t("확정본 연결 없음 (버전은 존재)"),
    danglingPrimary: t("확정 버전이 사라짐"),
    danglingWorkingDoc: t("작업문서가 사라짐"),
  };
  return detail
    .split(", ")
    .map((code) => labels[code] ?? code)
    .join(", ");
}

function IssueGroup({
  group,
  staleDays,
  spaceSlug,
  onTrash,
  isTrashing,
}: {
  group: IMaintenanceGroup;
  staleDays: number;
  spaceSlug: string;
  onTrash: (page: IMaintenancePage) => void;
  isTrashing: boolean;
}) {
  const { t } = useTranslation();
  const copy = useGroupCopy()(group.kind, staleDays);

  return (
    <Paper withBorder p="md" radius="sm">
      <Group justify="space-between" mb={4} wrap="nowrap">
        <Group gap="xs">
          <Text fw={600} size="sm">
            {copy.title}
          </Text>
          <Badge
            size="sm"
            variant="light"
            color={group.count > 0 ? "orange" : "gray"}
          >
            {group.count}
          </Badge>
        </Group>
      </Group>
      <Text size="xs" c="dimmed" mb={group.items.length > 0 ? "sm" : 0}>
        {copy.description}
      </Text>

      {group.items.length === 0 ? (
        <Text size="xs" c="dimmed">
          {t("해당 없음")}
        </Text>
      ) : (
        <>
          <Table verticalSpacing="xs" highlightOnHover>
            <Table.Tbody>
              {group.items.map((page) => (
                <Table.Tr key={page.id}>
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>
                      {page.icon ? `${page.icon} ` : ""}
                      {page.title || t("untitled")}
                    </Text>
                    {group.kind === "integrity" && page.detail && (
                      <Text size="xs" c="orange">
                        {integrityDetailLabel(page.detail, t)}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td w={170}>
                    <Text
                      size="xs"
                      c="dimmed"
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {formattedDate(new Date(page.updatedAt))}
                    </Text>
                  </Table.Td>
                  <Table.Td w={80}>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Tooltip label={t("열기")} withArrow>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          component={Link}
                          to={buildPageUrl(spaceSlug, page.slugId, page.title)}
                          target="_blank"
                          aria-label={t("열기")}
                        >
                          <IconExternalLink size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={t("휴지통으로")} withArrow>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          disabled={isTrashing}
                          onClick={() => onTrash(page)}
                          aria-label={t("휴지통으로")}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {group.count > group.items.length && (
            <Text size="xs" c="dimmed" mt="xs">
              {t("{{shown}}건만 표시했습니다. 정리 후 다시 검사하세요.", {
                shown: GROUP_ITEM_CAP,
              })}
            </Text>
          )}
        </>
      )}
    </Paper>
  );
}

export default function SpaceMaintenance({ spaceId, spaceSlug }: Props) {
  const { t } = useTranslation();
  const [started, setStarted] = useState(false);
  const { data, isFetching, isError, refetch } = useSpaceMaintenanceScanQuery(
    spaceId,
    started,
  );
  // 휴지통까지만 — useDeletePageMutation 은 영구 삭제라 여기선 쓰지 않는다
  const removePageMutation = useRemovePageMutation();

  const handleTrash = (page: IMaintenancePage) => {
    modals.openConfirmModal({
      title: t("휴지통으로 보내기"),
      children: (
        <Text size="sm">
          {t('"{{title}}" 을(를) 휴지통으로 보냅니다. 휴지통에서 복원할 수 있습니다.', {
            title: page.title || t("untitled"),
          })}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("휴지통으로"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        await removePageMutation.mutateAsync(page.id);
        queryClient.invalidateQueries({
          queryKey: ["space-maintenance", spaceId],
        });
        refetch();
      },
    });
  };

  const totalIssues =
    data?.groups.reduce((sum, group) => sum + group.count, 0) ?? 0;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Text fw={600} size="sm">
            {t("잘못된 페이지 점검")}
          </Text>
          <Text size="xs" c="dimmed">
            {t(
              "빈 페이지·제목 없는 페이지·장기 미확정 페이지와 형상관리 이상을 찾습니다. 정리는 휴지통까지만 하며 영구 삭제하지 않습니다.",
            )}
          </Text>
        </div>
        <Button
          size="xs"
          variant="default"
          leftSection={<IconRefresh size={14} />}
          loading={isFetching}
          onClick={() => {
            if (started) {
              refetch();
            } else {
              setStarted(true);
            }
          }}
        >
          {started ? t("다시 검사") : t("검사 시작")}
        </Button>
      </Group>

      {isError && (
        <Alert color="red" icon={<IconAlertTriangle size={16} />}>
          {t("점검을 실행하지 못했습니다.")}
        </Alert>
      )}

      {!started && (
        <EmptyState
          icon={IconChecks}
          title={t("아직 검사하지 않았습니다")}
          description={t("검사 시작을 눌러 이 Space의 페이지를 점검하세요.")}
        />
      )}

      {started && data && (
        <>
          {totalIssues === 0 ? (
            <EmptyState
              icon={IconChecks}
              title={t("정리할 페이지가 없습니다")}
              description={t("검사한 항목에서 문제를 찾지 못했습니다.")}
            />
          ) : (
            <Stack gap="sm">
              {data.groups.map((group) => (
                <IssueGroup
                  key={group.kind}
                  group={group}
                  staleDays={data.staleDays}
                  spaceSlug={spaceSlug}
                  onTrash={handleTrash}
                  isTrashing={removePageMutation.isPending}
                />
              ))}
            </Stack>
          )}

          <Text size="xs" c="dimmed">
            {t("마지막 검사 {{when}}", {
              when: formattedDate(new Date(data.scannedAt)),
            })}
          </Text>
        </>
      )}
    </Stack>
  );
}
