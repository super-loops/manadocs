import { Button, Divider, Group, Paper, Text } from "@mantine/core";
import { useAtom, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { modals } from "@mantine/modals";
import {
  activeWorkingDocAtom,
  commitDialogOpenAtom,
  diffSelectionAtom,
} from "@/features/page-version/atoms/page-version-atoms";
import {
  useResetWorkingDocMutation,
  useWorkingDocsQuery,
} from "@/features/page-version/queries/page-version-query";
import { IPage } from "@/features/page/types/page.types";
import classes from "./css/footer-pill.module.css";

interface FooterPillProps {
  page: IPage;
}

/**
 * 페이지 하단 floating pill — 이모지 · 문서버전 N · DIFF / 수정취소 / 문서확정.
 * 편집 권한자에게만 렌더된다.
 */
export default function FooterPill({ page }: FooterPillProps) {
  const { t } = useTranslation();
  const setCommitDialogOpen = useSetAtom(commitDialogOpenAtom);
  const setDiffSelection = useSetAtom(diffSelectionAtom);
  const [activeWorkingDoc] = useAtom(activeWorkingDocAtom);
  const { data: workingDocs } = useWorkingDocsQuery(page.id, true);
  const resetMutation = useResetWorkingDocMutation(page.id);

  const activeWorkingDocId =
    activeWorkingDoc?.pageId === page.id
      ? activeWorkingDoc.workingDocId
      : page.primaryWorkingDocId;

  const currentWorkingDoc = workingDocs?.find(
    (workingDoc) => workingDoc.id === activeWorkingDocId,
  );
  const baseVersion = currentWorkingDoc?.baseVersion?.version ?? 0;

  const confirmReset = () => {
    if (!currentWorkingDoc) return;
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
      onConfirm: () => resetMutation.mutate(currentWorkingDoc.id),
    });
  };

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
            {t("문서버전 {{n}}", { n: baseVersion })}
          </Text>
        </div>

        <Divider orientation="vertical" />

        <Button
          size="compact-sm"
          variant="default"
          onClick={() =>
            setDiffSelection({
              pageId: page.id,
              leftVersionId: currentWorkingDoc?.baseVersionId ?? null,
              rightVersionId: null, // null = 현재 작업문서
            })
          }
        >
          DIFF
        </Button>
        <Button size="compact-sm" variant="default" onClick={confirmReset}>
          {t("수정취소")}
        </Button>
        <Button size="compact-sm" onClick={() => setCommitDialogOpen(true)}>
          {t("문서확정")}
        </Button>
      </Group>
    </Paper>
  );
}
