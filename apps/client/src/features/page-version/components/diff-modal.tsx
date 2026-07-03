import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { IconArrowBackUp, IconArrowRight } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { HistoryEditor } from "@/features/page-history/components/history-editor";
import {
  diffCountsAtom,
  highlightChangesAtom,
} from "@/features/page-history/atoms/history-atoms";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { activeWorkingDocAtom, diffSelectionAtom } from "@/features/page-version/atoms/page-version-atoms";
import {
  usePageVersionQuery,
  usePageVersionsQuery,
  useResetWorkingDocMutation,
} from "@/features/page-version/queries/page-version-query";
import { usePageQuery } from "@/features/page/queries/page-query";
import { searchSuggestions } from "@/features/search/services/search-service";
import {
  BlockDiffEntry,
  computeBlockDiff,
  normalizeContent,
  revertBlock,
} from "@/features/page-version/utils/working-diff";

const CURRENT = "__current__";
const OTHER_DOC = "__other_doc__";

/**
 * DIFF 모달 — 좌(base) / 우(대상) 를 골라 비교.
 * - 같은 페이지의 버전 ↔ 버전
 * - 현재 작업문서(라이브) ↔ base 버전
 * - 다른 문서의 버전과 비교 (D4 문서간 diff)
 * 렌더 엔진은 page-history 의 HistoryEditor(prosemirror-changeset) 재사용.
 */
export default function DiffModal() {
  const { t } = useTranslation();
  const [diffSelection, setDiffSelection] = useAtom(diffSelectionAtom);

  return (
    <Modal.Root
      opened={!!diffSelection}
      onClose={() => setDiffSelection(null)}
      size={1100}
      padding="lg"
      yOffset="4vh"
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflowY: "auto", height: "92vh" }}>
        {diffSelection && <DiffModalBody key={diffSelection.pageId} />}
      </Modal.Content>
    </Modal.Root>
  );
}

function DiffModalBody() {
  const { t } = useTranslation();
  const [diffSelection, setDiffSelection] = useAtom(diffSelectionAtom);
  const [highlightChanges, setHighlightChanges] = useAtom(highlightChangesAtom);
  const diffCounts = useAtomValue(diffCountsAtom);
  const pageEditor = useAtomValue(pageEditorAtom);

  const pageId = diffSelection?.pageId;

  // ── 이 페이지의 버전 목록 ──────────────────────────────────────
  const { data: versionsData } = usePageVersionsQuery(pageId);
  const versions = useMemo(
    () => versionsData?.pages?.flatMap((p) => p.items) ?? [],
    [versionsData],
  );

  const versionOptions = versions.map((v) => ({
    value: v.id,
    label: `${t("버전")} ${v.version}${v.message ? ` — ${v.message}` : ""}${v.discardedAt ? ` (${t("폐기됨")})` : ""}`,
  }));

  const hasLiveEditor = !!pageEditor;

  // ── 좌/우 선택 상태 ────────────────────────────────────────────
  const [rightSel, setRightSel] = useState<string>(
    diffSelection?.rightVersionId ?? (hasLiveEditor ? CURRENT : ""),
  );
  const [leftSel, setLeftSel] = useState<string>(
    diffSelection?.leftVersionId ?? "",
  );

  // 좌측 기본값 — 우측보다 오래된 첫 버전
  useEffect(() => {
    if (leftSel || versions.length === 0) return;
    if (rightSel === CURRENT) {
      // 현재 작업문서의 비교 기준은 최신 비폐기 버전
      const base = versions.find((v) => !v.discardedAt && v.version > 0);
      if (base) setLeftSel(base.id);
    } else {
      const rightVersion = versions.find((v) => v.id === rightSel);
      const older = versions.find(
        (v) => rightVersion && v.version < rightVersion.version,
      );
      if (older) setLeftSel(older.id);
    }
  }, [versions, rightSel, leftSel]);

  // ── 다른 문서 비교 (좌측) ─────────────────────────────────────
  const [otherDocMode, setOtherDocMode] = useState(false);
  const [otherPageQuery, setOtherPageQuery] = useState("");
  const [otherPageId, setOtherPageId] = useState<string | null>(null);
  const [otherVersionId, setOtherVersionId] = useState<string | null>(null);

  const { data: otherPages } = useQuery({
    queryKey: ["diff-page-suggest", otherPageQuery],
    queryFn: () =>
      searchSuggestions({ query: otherPageQuery, includePages: true }),
    enabled: otherDocMode && otherPageQuery.length > 0,
  });
  const { data: otherVersionsData } = usePageVersionsQuery(
    otherDocMode ? (otherPageId ?? undefined) : undefined,
  );
  const otherVersions =
    otherVersionsData?.pages?.flatMap((p) => p.items) ?? [];

  // ── 콘텐츠 해석 ────────────────────────────────────────────────
  const leftVersionId = otherDocMode ? otherVersionId : leftSel || null;
  const { data: leftVersion } = usePageVersionQuery(
    leftVersionId && leftVersionId !== CURRENT ? leftVersionId : null,
  );
  const { data: rightVersion } = usePageVersionQuery(
    rightSel && rightSel !== CURRENT ? rightSel : null,
  );

  // 블럭별 되돌림 후 diff 재계산용 tick
  const [revertTick, setRevertTick] = useState(0);

  const { data: page } = usePageQuery({ pageId: pageId ?? "" });
  const activeWorkingDoc = useAtomValue(activeWorkingDocAtom);
  const resetMutation = useResetWorkingDocMutation(pageId ?? "");

  const rightContent = useMemo(
    () =>
      rightSel === CURRENT ? pageEditor?.getJSON() : rightVersion?.content,
    // revertTick 이 바뀌면 라이브 에디터 최신 상태로 재계산
    [rightSel, pageEditor, rightVersion, revertTick],
  );
  const rightTitle =
    rightSel === CURRENT
      ? t("현재 작업문서")
      : (rightVersion?.title ?? "");
  const leftContent = leftVersion?.content;

  const ready = !!rightContent && !!leftContent;

  // ── 수정취소 모드: 좌=Primary, 우=현재 작업문서 매칭일 때만 ──────
  const resetMode =
    !otherDocMode &&
    rightSel === CURRENT &&
    !!page?.primaryVersionId &&
    leftSel === page.primaryVersionId;

  const activeWorkingDocId =
    activeWorkingDoc?.pageId === pageId
      ? activeWorkingDoc.workingDocId
      : (page?.primaryWorkingDocId ?? null);

  // base(서버 JSON)를 에디터 스키마로 정규화 후 블럭 비교 — 직렬화 비대칭 제거
  const normalizedLeft = useMemo(
    () =>
      resetMode && leftContent && pageEditor
        ? normalizeContent(pageEditor, leftContent)
        : leftContent,
    [resetMode, leftContent, pageEditor],
  );

  const blockDiff: BlockDiffEntry[] = useMemo(
    () =>
      resetMode && ready
        ? computeBlockDiff(normalizedLeft, rightContent)
        : [],
    [resetMode, ready, normalizedLeft, rightContent],
  );

  const handleResetAll = () => {
    if (!activeWorkingDocId) return;
    modals.openConfirmModal({
      title: t("전체 수정취소"),
      children: (
        <Text size="sm">
          {t(
            "이 작업문서의 모든 변경을 되돌리고 Primary 버전 내용으로 리셋합니다. 계속할까요?",
          )}
        </Text>
      ),
      labels: { confirm: t("전체 수정취소"), cancel: t("취소") },
      confirmProps: { color: "red" },
      onConfirm: () => {
        // 전체 리셋은 라이브 문서를 통째로 교체 → 모달 즉시 닫고 리셋 발사
        setDiffSelection(null);
        resetMutation.mutate(activeWorkingDocId);
      },
    });
  };

  const handleRevertBlock = (entry: BlockDiffEntry) => {
    if (!pageEditor || pageEditor.isDestroyed) return;
    const ok = revertBlock(pageEditor, entry, normalizedLeft);
    if (ok) {
      setRevertTick((n) => n + 1);
    } else {
      notifications.show({
        message: "이 블럭은 되돌릴 수 없어요.",
        color: "yellow",
      });
    }
  };

  const blockStatusLabel: Record<BlockDiffEntry["status"], string> = {
    modified: t("수정됨"),
    added: t("추가됨"),
    removed: t("삭제됨"),
  };
  const blockStatusColor: Record<BlockDiffEntry["status"], string> = {
    modified: "yellow",
    added: "green",
    removed: "red",
  };

  return (
    <>
      <Modal.Header py={8}>
        <Group gap="xs" wrap="wrap">
          <Modal.Title>
            <Text fw={600}>DIFF</Text>
          </Modal.Title>

          {/* 좌(base) */}
          {otherDocMode ? (
            <>
              <Select
                size="xs"
                w={200}
                searchable
                placeholder={t("문서 검색…")}
                searchValue={otherPageQuery}
                onSearchChange={setOtherPageQuery}
                data={(otherPages?.pages ?? [])
                  .filter(Boolean)
                  .map((p: any) => ({
                    value: p.id,
                    label: `${p.icon ?? "📄"} ${p.title || t("untitled")}`,
                  }))}
                value={otherPageId}
                onChange={(value) => {
                  setOtherPageId(value);
                  setOtherVersionId(null);
                }}
              />
              <Select
                size="xs"
                w={200}
                placeholder={t("버전 선택")}
                data={otherVersions
                  .filter((v) => v.version > 0)
                  .map((v) => ({
                    value: v.id,
                    label: `${t("버전")} ${v.version}${v.message ? ` — ${v.message}` : ""}`,
                  }))}
                value={otherVersionId}
                onChange={setOtherVersionId}
              />
            </>
          ) : (
            <Select
              size="xs"
              w={230}
              placeholder={t("기준(base) 버전")}
              data={[
                ...versionOptions,
                { value: OTHER_DOC, label: t("다른 문서에서 선택…") },
              ]}
              value={leftSel || null}
              onChange={(value) => {
                if (value === OTHER_DOC) {
                  setOtherDocMode(true);
                } else {
                  setLeftSel(value ?? "");
                }
              }}
            />
          )}

          <IconArrowRight size={16} />

          {/* 우(대상) */}
          <Select
            size="xs"
            w={230}
            placeholder={t("비교 대상")}
            data={[
              ...(hasLiveEditor
                ? [{ value: CURRENT, label: t("현재 작업문서") }]
                : []),
              ...versionOptions,
            ]}
            value={rightSel || null}
            onChange={(value) => setRightSel(value ?? "")}
          />

          {diffCounts && (
            <Group gap={6}>
              <Badge size="sm" variant="light" color="green" radius="sm">
                {diffCounts.added} +
              </Badge>
              <Badge size="sm" variant="light" color="red" radius="sm">
                {diffCounts.deleted} -
              </Badge>
            </Group>
          )}

          <Switch
            size="xs"
            label={t("변경 강조")}
            checked={highlightChanges}
            onChange={(e) => setHighlightChanges(e.currentTarget.checked)}
          />

          {resetMode && blockDiff.length > 0 && (
            <Button
              size="compact-sm"
              variant="light"
              color="red"
              leftSection={<IconArrowBackUp size={14} />}
              onClick={handleResetAll}
            >
              {t("전체 수정취소")}
            </Button>
          )}
        </Group>
        <Modal.CloseButton />
      </Modal.Header>
      <Modal.Body>
        {/* 블럭별 수정취소 — Primary ↔ 현재 작업문서일 때만 */}
        {resetMode && blockDiff.length > 0 && (
          <Card withBorder radius="md" padding="xs" mb="sm">
            <Text size="xs" fw={600} c="dimmed" mb={6}>
              {t("변경된 블럭 {{n}}개 — 블럭별 수정취소", {
                n: blockDiff.length,
              })}
            </Text>
            <ScrollArea.Autosize mah={160}>
              <Stack gap={4}>
                {blockDiff.map((entry) => (
                  <Group
                    key={`${entry.blockId}:${entry.status}`}
                    gap="xs"
                    wrap="nowrap"
                  >
                    <Badge
                      size="sm"
                      variant="light"
                      radius="sm"
                      color={blockStatusColor[entry.status]}
                      w={56}
                    >
                      {blockStatusLabel[entry.status]}
                    </Badge>
                    <Text size="sm" lineClamp={1} style={{ flex: 1 }}>
                      {entry.preview || t("(빈 블럭)")}
                    </Text>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      title={t("이 블럭 되돌리기")}
                      onClick={() => handleRevertBlock(entry)}
                    >
                      <IconArrowBackUp size={16} />
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          </Card>
        )}

        <ScrollArea>
          {ready ? (
            <HistoryEditor
              key={`${leftVersionId}:${rightSel}:${revertTick}`}
              title={rightTitle}
              content={rightContent}
              previousContent={leftContent}
            />
          ) : (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {t("비교할 버전을 선택하세요")}
            </Text>
          )}
        </ScrollArea>
      </Modal.Body>
    </>
  );
}
