import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useParams } from "react-router-dom";
import {
  activeHistoryIdAtom,
  historyAtoms,
} from "@/features/page-history/atoms/history-atoms";
import { usePageHistoryQuery } from "@/features/page-history/queries/page-history-query";
import {
  pageEditorAtom,
  pageEditorContentReadyAtom,
  titleEditorAtom,
} from "@/features/editor/atoms/editor-atoms";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability";
import { useSpaceQuery } from "@/features/space/queries/space-query";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type";

export function useHistoryRestore() {
  const { t } = useTranslation();

  const activeHistoryId = useAtomValue(activeHistoryIdAtom);
  const { data: activeHistoryData } = usePageHistoryQuery(activeHistoryId);

  const mainEditor = useAtomValue(pageEditorAtom);
  const mainEditorTitle = useAtomValue(titleEditorAtom);
  const pageEditorReady = useAtomValue(pageEditorContentReadyAtom);
  const setHistoryModalOpen = useSetAtom(historyAtoms);

  const { spaceSlug } = useParams();
  const { data: space } = useSpaceQuery(spaceSlug);
  const spaceAbility = useSpaceAbility(space?.membership?.permissions);

  const canRestore = spaceAbility.can(
    SpaceCaslAction.Manage,
    SpaceCaslSubject.Page,
  );

  const handleRestore = useCallback(() => {
    if (!activeHistoryData) return;

    /**
     * ⚠ 이 훅은 **현재 마운트되지 않는다** — HistoryModal 을 import 하는 곳이
     * 없다. 그래도 가드를 둔다: 아래는 문서를 통째로 갈아엎는(`clearContent` +
     * `setContent`) 이 레포에서 가장 파괴적인 쓰기인데, 페이지 히스토리를
     * 되살리는 사람이 아래 두 함정을 모른 채 밟기 때문이다.
     *
     *  - 에디터 atom 은 지금 열려 있는 페이지 것이 아닐 수 있다(죽었거나 없음).
     *    죽은 에디터에 쓰면 **앞 페이지 문서**를 지운다.
     *  - 협업 문서가 아직 안 실렸으면(`pageEditorContentReadyAtom`) 빈 ydoc 을
     *    지우고 복원본을 넣게 되는데, 뒤늦게 도착한 진짜 본문과 Yjs 가 병합해
     *    **내용이 중복**된다.
     */
    if (
      !mainEditor ||
      mainEditor.isDestroyed ||
      !mainEditorTitle ||
      mainEditorTitle.isDestroyed ||
      !pageEditorReady
    ) {
      notifications.show({
        message: t("본문을 불러오는 중입니다. 잠시 후 다시 시도해 주세요."),
        color: "red",
      });
      return;
    }

    mainEditorTitle
      .chain()
      .clearContent()
      .setContent(activeHistoryData.title, { emitUpdate: true })
      .run();

    mainEditor
      .chain()
      .clearContent()
      .setContent(activeHistoryData.content)
      .run();

    setHistoryModalOpen(false);
    notifications.show({ message: t("Successfully restored") });
  }, [
    activeHistoryData,
    mainEditor,
    mainEditorTitle,
    pageEditorReady,
    setHistoryModalOpen,
    t,
  ]);

  const confirmRestore = useCallback(() => {
    modals.openConfirmModal({
      title: t("Please confirm your action"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to restore this version? Any changes not versioned will be lost.",
          )}
        </Text>
      ),
      labels: { confirm: t("Confirm"), cancel: t("Cancel") },
      onConfirm: handleRestore,
    });
  }, [t, handleRestore]);

  return { canRestore, confirmRestore };
}
