import { useEffect, useMemo, useState } from "react";
import { Button, Divider, Group, Paper, Text } from "@mantine/core";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import {
  commitDialogOpenAtom,
  diffSelectionAtom,
} from "@/features/page-version/atoms/page-version-atoms";
import { usePageVersionQuery } from "@/features/page-version/queries/page-version-query";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { IPage } from "@/features/page/types/page.types";
import { computeDiffStats } from "@/features/page-version/utils/working-diff";
import classes from "./css/footer-pill.module.css";

interface FooterPillProps {
  page: IPage;
}

/**
 * 페이지 하단 floating pill.
 * - 현재 작업문서 == Primary 버전 → [이모지 · 문서버전N · DIFF] 만
 * - 다르면 → [이모지 · 문서버전N · +N/−N · DIFF · 문서확정]
 * 수정취소는 DIFF 모달로 이관(footer 에서 제거).
 */
export default function FooterPill({ page }: FooterPillProps) {
  const { t } = useTranslation();
  const setCommitDialogOpen = useSetAtom(commitDialogOpenAtom);
  const setDiffSelection = useSetAtom(diffSelectionAtom);
  const editor = useAtomValue(pageEditorAtom);

  const primaryVersionId = page.primaryVersionId ?? null;
  const { data: primaryVersion } = usePageVersionQuery(primaryVersionId);
  const primaryContent = primaryVersion?.content ?? null;
  const versionLabel = primaryVersion?.version ?? 0;

  // 라이브 에디터 ↔ Primary 비교 (편집 시 디바운스 재계산)
  const [changed, setChanged] = useState(false);
  const [stats, setStats] = useState({ added: 0, deleted: 0 });

  const recompute = useMemo(
    () => () => {
      if (!editor || editor.isDestroyed) {
        setChanged(false);
        return;
      }
      // 미확정 페이지(Primary 버전 없음) — 첫 문서확정을 허용해야 하므로
      // 항상 변경으로 취급(비교 기준이 없어 통계는 생략).
      if (!primaryVersionId) {
        setChanged(true);
        setStats({ added: 0, deleted: 0 });
        return;
      }
      if (!primaryContent) return; // Primary 콘텐츠 로딩 중 — 이전 판정 유지
      const current = editor.getJSON();
      // 동일 diff 엔진(ChangeSet)으로 판정 — 양쪽을 같은 스키마로 정규화하므로
      // 서버 저장 JSON ↔ 에디터 JSON 직렬화 차이에 오탐하지 않는다.
      const s = computeDiffStats(editor, primaryContent, current);
      setChanged(s.total > 0);
      setStats(s);
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

        <div>
          <Text size="xs" fw={600} lh={1.2}>
            {t("문서버전 {{n}}", { n: versionLabel })}
          </Text>
          {changed && (stats.added > 0 || stats.deleted > 0) && (
            <Group gap={6} mt={2}>
              <Text size="xs" c="green.7" fw={600}>
                {stats.added} +
              </Text>
              <Text size="xs" c="red.7" fw={600}>
                {stats.deleted} −
              </Text>
            </Group>
          )}
        </div>

        <Divider orientation="vertical" />

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

        {changed && (
          <Button size="compact-sm" onClick={() => setCommitDialogOpen(true)}>
            {t("문서확정")}
          </Button>
        )}
      </Group>
    </Paper>
  );
}
