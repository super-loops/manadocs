import { useEffect, useState } from "react";
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
import { queryClient } from "@/main.tsx";
import {
  IMaintenanceGroup,
  IMaintenancePage,
  MaintenanceIssueKind,
} from "@/features/space/types/space-maintenance.types.ts";

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
  pendingPageId,
  trashedIdSet,
}: {
  group: IMaintenanceGroup;
  staleDays: number;
  spaceSlug: string;
  onTrash: (page: IMaintenancePage) => void;
  /** 지금 휴지통 요청이 걸린 행. 전 행을 한꺼번에 잠그지 않는다 */
  pendingPageId: string | null;
  /** 이미 휴지통으로 이동한 페이지 id — 캐스케이드로 딸려간 하위 행도 들어 있다 */
  trashedIdSet: Set<string>;
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
              {group.items.map((page) => {
                // 보낸 행은 목록에서 빼지 않고 흐리게 남긴다 — 「무엇을 몇 건
                // 처리했는지」가 다시 검사 전까지 누적으로 보이게.
                const gone = trashedIdSet.has(page.id);

                return (
                  <Table.Tr key={page.id} opacity={gone ? 0.45 : 1}>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Text
                          size="sm"
                          lineClamp={1}
                          td={gone ? "line-through" : undefined}
                        >
                          {page.icon ? `${page.icon} ` : ""}
                          {page.title || t("untitled")}
                        </Text>
                        {gone ? (
                          <Badge
                            size="xs"
                            variant="light"
                            color="gray"
                            style={{ flexShrink: 0 }}
                          >
                            {t("휴지통으로 보냄")}
                          </Badge>
                        ) : (
                          page.descendantCount > 0 && (
                            <Tooltip
                              label={t(
                                "이 페이지를 지우면 하위 페이지도 함께 휴지통으로 갑니다.",
                              )}
                              withArrow
                            >
                              <Badge
                                size="xs"
                                variant="light"
                                color="orange"
                                leftSection={<IconAlertTriangle size={10} />}
                                style={{ cursor: "help", flexShrink: 0 }}
                              >
                                {t("하위 {{sub}}", {
                                  sub: page.descendantCount,
                                })}
                              </Badge>
                            </Tooltip>
                          )
                        )}
                      </Group>
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
                        {gone ? (
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            disabled
                            aria-label={t("휴지통으로 보냄")}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        ) : (
                          <>
                            <Tooltip label={t("열기")} withArrow>
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                component={Link}
                                to={buildPageUrl(
                                  spaceSlug,
                                  page.slugId,
                                  page.title,
                                )}
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
                                loading={pendingPageId === page.id}
                                disabled={!!pendingPageId}
                                onClick={() => onTrash(page)}
                                aria-label={t("휴지통으로")}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
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
  /**
   * 이번 검사 결과에서 **실제로 휴지통으로 이동한 페이지 id** 전부.
   * 서버가 캐스케이드로 데려간 하위 페이지까지 들어 있어야, 목록에 같이
   * 떠 있던 하위 행도 함께 «보냄» 으로 꺼진다.
   */
  const [trashedIdSet, setTrashedIdSet] = useState<Set<string>>(new Set());
  /** 유저가 직접 누른 행 수 — «몇 건을 정리했나» 는 클릭 기준으로 센다 */
  const [trashedRowCount, setTrashedRowCount] = useState(0);
  const { data, isFetching, isError, refetch } = useSpaceMaintenanceScanQuery(
    spaceId,
    started,
  );
  // 휴지통까지만 — useDeletePageMutation 은 영구 삭제라 여기선 쓰지 않는다
  const removePageMutation = useRemovePageMutation();

  /**
   * 휴지통 이동 성공 뒤 목록을 어떻게 갱신할지 — **여기 한 군데**로 모아 둔다.
   *
   * 자동 재검사는 하지 않는다. 스캔을 곧바로 다시 돌리면 목록이 통째로
   * 갈아엎어지고, 마지막 한 건을 지웠을 때는 손대지도 않은 그룹 카드까지
   * 한꺼번에 사라져 «모든 목록이 삭제된» 것처럼 보인다. 대신 지운 행을
   * 그 자리에 흐리게 남겨 처리 내역이 누적으로 보이게 하고, 갱신은
   * 「다시 검사」를 눌렀을 때만 한다.
   */
  const afterTrash = (trashedPageIds: string[]) => {
    if (trashedPageIds.length === 0) return; // 아무것도 안 갔으면 표시도 없다
    setTrashedIdSet((prev) => new Set([...prev, ...trashedPageIds]));
    setTrashedRowCount((prev) => prev + 1);
  };

  /** 새로 스캔할 때는 누적 표시를 비운다 */
  const rescan = () => {
    setTrashedIdSet(new Set());
    setTrashedRowCount(0);
    if (started) {
      refetch();
    } else {
      // staleTime 이 Infinity 라 캐시가 남아 있으면 예전 결과가 그대로 뜬다.
      // 정리한 뒤 재검사 없이 돌아왔을 때 이미 지운 페이지가 «살아 있는 문제»로
      // 보이지 않게, 켜기 전에 캐시를 버린다.
      queryClient.removeQueries({ queryKey: ["space-maintenance", spaceId] });
      setStarted(true);
    }
  };

  // Space 를 옮기면 앞 Space 의 정리 내역·검사 상태가 남으면 안 된다.
  // effect 로 미루면 새 Space 의 첫 프레임에 앞 Space 의 결과가 비친다.
  const [lastSpaceId, setLastSpaceId] = useState(spaceId);
  if (spaceId !== lastSpaceId) {
    setLastSpaceId(spaceId);
    setStarted(false);
    setTrashedIdSet(new Set());
    setTrashedRowCount(0);
  }

  const handleTrash = (page: IMaintenancePage) => {
    const title = page.title || t("untitled");
    // 서버의 휴지통 이동은 하위 트리 전체를 캐스케이드한다(PageRepo.removePage).
    // 모달이 «한 건만 간다»고 말하면 거짓말이 되므로 실제 건수를 밝힌다.
    const sub = page.descendantCount;
    const total = sub + 1;

    modals.openConfirmModal({
      title: t("휴지통으로 보내기"),
      children:
        sub > 0 ? (
          <Stack gap="xs">
            <Alert color="orange" icon={<IconAlertTriangle size={16} />} p="xs">
              <Text size="sm">
                {t(
                  '"{{title}}" 과(와) 하위 페이지 {{sub}}개, 모두 {{total}}개 페이지를 휴지통으로 보냅니다.',
                  { title, sub, total },
                )}
              </Text>
            </Alert>
            <Text size="sm" c="dimmed">
              {t("휴지통에서 복원할 수 있습니다.")}
            </Text>
          </Stack>
        ) : (
          <Text size="sm">
            {t(
              '"{{title}}" 1개 페이지를 휴지통으로 보냅니다. 휴지통에서 복원할 수 있습니다.',
              { title },
            )}
          </Text>
        ),
      centered: true,
      labels: { confirm: t("휴지통으로"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          const result = await removePageMutation.mutateAsync(page.id);
          afterTrash(result.trashedPageIds);
        } catch {
          // 실패 알림은 뮤테이션의 onError 가 띄운다. 여기서 삼키지 않으면
          // 모달이 반환값을 안 보므로 unhandled rejection 이 된다.
          // 실패한 행은 «보냄» 으로 표시하지 않는다 — 그대로 남는다.
        }
      },
    });
  };

  // 누른 행만 반응하게 — 전 행을 한꺼번에 잠그면 «패널 전체가 리셋된» 것처럼 보인다
  const pendingPageId = removePageMutation.isPending
    ? (removePageMutation.variables ?? null)
    : null;

  const totalIssues =
    data?.groups.reduce((sum, group) => sum + group.count, 0) ?? 0;

  // 서버가 돌려준 id 를 그대로 세므로 캐스케이드로 겹친 페이지를 두 번 세지 않는다
  const trashedPageTotal = trashedIdSet.size;
  const cascaded = trashedPageTotal > trashedRowCount;

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
          onClick={rescan}
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
              {trashedRowCount > 0 && (
                <Alert
                  color="gray"
                  variant="light"
                  icon={<IconTrash size={16} />}
                  p="xs"
                >
                  <Text size="xs">
                    {t(
                      "이번 검사에서 {{rows}}건을 정리해 {{pages}}개 페이지를 휴지통으로 보냈습니다. 목록은 「다시 검사」를 눌러야 갱신됩니다.",
                      { rows: trashedRowCount, pages: trashedPageTotal },
                    )}
                  </Text>
                  {cascaded && (
                    <Text size="xs" c="orange" mt={4}>
                      {t("하위 페이지가 함께 이동했습니다.")}
                    </Text>
                  )}
                </Alert>
              )}
              {data.groups.map((group) => (
                <IssueGroup
                  key={group.kind}
                  group={group}
                  staleDays={data.staleDays}
                  spaceSlug={spaceSlug}
                  onTrash={handleTrash}
                  pendingPageId={pendingPageId}
                  trashedIdSet={trashedIdSet}
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
