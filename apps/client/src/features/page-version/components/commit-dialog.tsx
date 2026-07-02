import { Button, Group, Modal, Text, TextInput } from "@mantine/core";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  activeWorkingDocAtom,
  commitDialogOpenAtom,
} from "@/features/page-version/atoms/page-version-atoms";
import { useCommitVersionMutation } from "@/features/page-version/queries/page-version-query";

interface CommitDialogProps {
  pageId: string;
}

/**
 * 문서확정(commit) 다이얼로그 — 메시지 입력 후 확정.
 * 확정된 버전은 항상 자동 Primary(D7)가 되어 독자·공유에 즉시 반영됨을 안내.
 */
export default function CommitDialog({ pageId }: CommitDialogProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useAtom(commitDialogOpenAtom);
  const activeWorkingDoc = useAtomValue(activeWorkingDocAtom);
  const [message, setMessage] = useState("");
  const commitMutation = useCommitVersionMutation(pageId);

  const workingDocId =
    activeWorkingDoc?.pageId === pageId
      ? activeWorkingDoc.workingDocId
      : undefined;

  const handleCommit = async () => {
    await commitMutation.mutateAsync({
      pageId,
      workingDocId,
      message: message.trim() || undefined,
    });
    setMessage("");
    setOpened(false);
  };

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title={t("문서확정")}
      centered
    >
      <TextInput
        data-autofocus
        label={t("확정 메시지")}
        placeholder={t("무엇을 바꿨나요?")}
        value={message}
        onChange={(e) => setMessage(e.currentTarget.value)}
        maxLength={500}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            handleCommit();
          }
        }}
      />

      <Text size="xs" c="dimmed" mt="sm">
        {t(
          "확정된 버전은 이 페이지의 Primary 가 되어 독자와 공유 링크(최신 추종)에 즉시 반영됩니다.",
        )}
      </Text>

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={() => setOpened(false)}>
          {t("취소")}
        </Button>
        <Button
          loading={commitMutation.isPending}
          onClick={handleCommit}
        >
          {t("문서확정")}
        </Button>
      </Group>
    </Modal>
  );
}
