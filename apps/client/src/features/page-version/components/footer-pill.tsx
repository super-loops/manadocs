import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Button,
  Code,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconClock } from "@tabler/icons-react";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import {
  activeWorkingDocAtom,
  commitDialogOpenAtom,
  diffSelectionAtom,
} from "@/features/page-version/atoms/page-version-atoms";
import {
  usePageVersionQuery,
  useWorkingDocsQuery,
} from "@/features/page-version/queries/page-version-query";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { IPage } from "@/features/page/types/page.types";
import { computeUncommittedStats } from "@/features/page-version/utils/working-diff";
import { formattedDate } from "@/lib/time";
import { getBranchCode } from "@/lib/branch-code";
import { useTimeAgo } from "@/hooks/use-time-ago";
import classes from "./css/footer-pill.module.css";

interface FooterPillProps {
  page: IPage;
}

/** 시각이 아직 없을 때 훅에 넘길 고정 값 — 매 렌더 new Date() 를 만들지 않는다 */
const EPOCH = new Date(0);

/**
 * 페이지 하단 floating pill.
 * - 미확정(확정 버전 0개) → [이모지 · 미확정 · +N · 문서확정]
 *   비교 기준(Primary)이 없으므로 "문서버전 0" 을 쓰지 않고 DIFF 도 비활성.
 * - 확정본 있음 → [이모지 · 문서버전N · (+N/−N) · DIFF · (문서확정)]
 * 작업문서가 둘 이상이면 지금 편집 중인 작업문서 이름도 함께 보여준다.
 * 수정취소는 DIFF 모달로 이관(footer 에서 제거).
 */
export default function FooterPill({ page }: FooterPillProps) {
  const { t } = useTranslation();
  const setCommitDialogOpen = useSetAtom(commitDialogOpenAtom);
  const setDiffSelection = useSetAtom(diffSelectionAtom);
  const editor = useAtomValue(pageEditorAtom);
  const activeWorkingDoc = useAtomValue(activeWorkingDocAtom);

  const primaryVersionId = page.primaryVersionId ?? null;
  const { data: primaryVersion } = usePageVersionQuery(primaryVersionId);
  const primaryContent = primaryVersion?.content ?? null;
  const versionLabel = primaryVersion?.version ?? 0;
  const isDraft = !primaryVersionId;

  // ── 편집 중인 작업문서 (여러 개일 때만 이름 노출) ────────────────
  const canEdit = page.permissions?.canEdit ?? false;
  const { data: workingDocs } = useWorkingDocsQuery(page.id, canEdit);
  const activeWorkingDocId =
    activeWorkingDoc?.pageId === page.id
      ? activeWorkingDoc.workingDocId
      : (page.primaryWorkingDocId ?? null);
  const currentWorkingDoc = (workingDocs ?? []).find(
    (doc) => doc.id === activeWorkingDocId,
  );
  const workingDocName =
    (workingDocs?.length ?? 0) > 1 && currentWorkingDoc
      ? currentWorkingDoc.name ||
        (currentWorkingDoc.baseVersion
          ? t("버전 {{n}}에서 시작", {
              n: currentWorkingDoc.baseVersion.version,
            })
          : t("작업문서"))
      : null;
  // 분기코드는 분기가 하나뿐이어도 보인다 — 협업자·에이전트가 "지금 같은
  // 분기를 보고 있나" 를 이 칩 하나로 맞춘다.
  const branchCode = getBranchCode(activeWorkingDocId);

  /**
   * 수정 시작 — 전용 필드가 없어 두 시각 중 나중을 쓴다.
   * - 작업문서 생성 시각: "새 작업문서"로 만든 경우엔 이게 편집 시작이다.
   * - 기준 버전 확정 시각: Primary 작업문서는 페이지 생성 때 만들어져
   *   createdAt 이 편집 시작이 아니다. 확정할 때마다 base 가 옮겨가므로
   *   이 값이 현재 편집 사이클의 시작이다.
   * 두 후보의 약점이 서로 배타적이라 max 가 양쪽 경우 모두 맞는다.
   */
  const editingStartedAt = currentWorkingDoc
    ? new Date(
        Math.max(
          new Date(currentWorkingDoc.createdAt).getTime(),
          currentWorkingDoc.baseVersion
            ? new Date(currentWorkingDoc.baseVersion.createdAt).getTime()
            : 0,
        ),
      )
    : null;
  const lastEditedAt = currentWorkingDoc
    ? new Date(currentWorkingDoc.updatedAt)
    : null;
  const lastEditedAgo = useTimeAgo(lastEditedAt ?? EPOCH);
  const hasTimestamps = !!editingStartedAt && !!lastEditedAt;

  // 라이브 에디터 ↔ Primary 비교 (편집 시 디바운스 재계산)
  const [changed, setChanged] = useState(false);
  const [stats, setStats] = useState({ added: 0, deleted: 0 });

  // 400ms 마다 새 객체를 넣으면 숫자가 그대로여도 매번 리렌더된다 —
  // 실제로 값이 달라질 때만 반영해 편집 중 렌더 churn 을 줄인다.
  const applyStats = (next: { added: number; deleted: number }) =>
    setStats((prev) =>
      prev.added === next.added && prev.deleted === next.deleted ? prev : next,
    );

  const recompute = useMemo(
    () => () => {
      if (!editor || editor.isDestroyed) {
        setChanged(false);
        return;
      }
      // Primary 콘텐츠 로딩 중이면 이전 판정을 유지한다(깜빡임 방지)
      if (primaryVersionId && !primaryContent) return;
      // 미확정 판정은 사이드바 "수정중"·결합 패널 뱃지와 **같은 함수**로 한다.
      // 예전엔 여기서 확정본 없는 페이지를 무조건 변경으로 취급했는데, 갓 만든
      // 빈 페이지의 빈 문단 하나가 +1 로 잡혀 유령 수정이 되었다(F-1).
      const s = computeUncommittedStats(
        editor,
        primaryVersionId ? primaryContent : null,
        editor.getJSON(),
      );
      setChanged(s.total > 0);
      applyStats(s);
    },
    [editor, primaryVersionId, primaryContent],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    recompute();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(recompute, 400);
    };
    editor.on("update", onUpdate);
    return () => {
      if (timer) clearTimeout(timer);
      try {
        editor.off("update", onUpdate);
      } catch {
        // editor 정리됨
      }
    };
  }, [editor, recompute]);

  const hasStats = stats.added > 0 || stats.deleted > 0;

  return (
    <Paper
      className={classes.pill}
      shadow="md"
      radius="xl"
      px="md"
      py={8}
      withBorder
    >
      <Group gap="sm" wrap="nowrap">
        <Text size="lg" lh={1}>
          {page.icon || "📄"}
        </Text>

        <div className={classes.info}>
          <Group gap={6} wrap="nowrap">
            <Text
              size="xs"
              fw={600}
              lh={1.2}
              c={isDraft ? "orange.7" : undefined}
            >
              {isDraft ? t("미확정") : t("문서버전 {{n}}", { n: versionLabel })}
            </Text>
            {hasStats && (
              <>
                {stats.added > 0 && (
                  <Text size="xs" c="green.7" fw={600}>
                    {stats.added} +
                  </Text>
                )}
                {stats.deleted > 0 && (
                  <Text size="xs" c="red.7" fw={600}>
                    {stats.deleted} −
                  </Text>
                )}
              </>
            )}
          </Group>
          {branchCode && (
            <Group gap={4} wrap="nowrap" mt={2}>
              <Tooltip label={t("분기코드")} openDelay={400} withArrow>
                <Code fz={9} px={3} lh={1.4}>
                  {branchCode}
                </Code>
              </Tooltip>
              {workingDocName && (
                <Text size="xs" c="dimmed" lh={1.2} lineClamp={1} maw={120}>
                  {workingDocName}
                </Text>
              )}
            </Group>
          )}
        </div>

        {/* 작업문서 로딩이 끝나고 나타나면 그만큼 오른쪽 버튼이 밀린다 —
            자리는 항상 잡아두고 내용만 채운다. */}
        <Tooltip
          withArrow
          multiline
          disabled={!hasTimestamps}
          label={
            hasTimestamps ? (
              <Stack gap={2}>
                <Text size="xs">
                  {t("수정 시작")}: {formattedDate(editingStartedAt)}
                </Text>
                <Text size="xs">
                  {t("마지막 수정")}: {formattedDate(lastEditedAt)} (
                  {lastEditedAgo})
                </Text>
              </Stack>
            ) : null
          }
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            style={{ visibility: hasTimestamps ? "visible" : "hidden" }}
          >
            <IconClock size={16} stroke={1.7} />
          </ActionIcon>
        </Tooltip>

        <Divider orientation="vertical" />

        {/* [문서확정] 은 변경이 있을 때만 나타난다(의도된 동작). 그때 DIFF 가
            밀리지 않도록 버튼 묶음의 폭을 고정하고 왼쪽으로 붙인다. */}
        <Group gap="sm" wrap="nowrap" w={148} justify="flex-start">
          {isDraft ? (
            <Tooltip
              label={t("확정된 버전이 없어 비교할 대상이 없습니다")}
              withArrow
            >
              {/* disabled 버튼은 포인터 이벤트가 없어 span 으로 감싼다 */}
              <span>
                <Button size="compact-sm" variant="default" disabled>
                  DIFF
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button
              size="compact-sm"
              variant="default"
              onClick={() =>
                setDiffSelection({
                  pageId: page.id,
                  leftVersionId: primaryVersionId, // Primary 기준
                  rightVersionId: null, // null = 현재 작업문서
                })
              }
            >
              DIFF
            </Button>
          )}

          {changed && (
            <Button size="compact-sm" onClick={() => setCommitDialogOpen(true)}>
              {t("문서확정")}
            </Button>
          )}
        </Group>
      </Group>
    </Paper>
  );
}
