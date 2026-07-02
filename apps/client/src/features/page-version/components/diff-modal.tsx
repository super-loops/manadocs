import {
  Badge,
  Group,
  Modal,
  ScrollArea,
  Select,
  Switch,
  Text,
} from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { HistoryEditor } from "@/features/page-history/components/history-editor";
import {
  diffCountsAtom,
  highlightChangesAtom,
} from "@/features/page-history/atoms/history-atoms";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import {
  diffSelectionAtom,
} from "@/features/page-version/atoms/page-version-atoms";
import {
  usePageVersionQuery,
  usePageVersionsQuery,
} from "@/features/page-version/queries/page-version-query";
import { searchSuggestions } from "@/features/search/services/search-service";

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
  const [diffSelection] = useAtom(diffSelectionAtom);
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

  const rightContent =
    rightSel === CURRENT ? pageEditor?.getJSON() : rightVersion?.content;
  const rightTitle =
    rightSel === CURRENT
      ? t("현재 작업문서")
      : (rightVersion?.title ?? "");
  const leftContent = leftVersion?.content;

  const ready = !!rightContent && !!leftContent;

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
        </Group>
        <Modal.CloseButton />
      </Modal.Header>
      <Modal.Body>
        <ScrollArea>
          {ready ? (
            <HistoryEditor
              key={`${leftVersionId}:${rightSel}`}
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
