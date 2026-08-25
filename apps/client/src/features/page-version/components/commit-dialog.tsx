import { Alert, Button, Group, Modal, Text, TextInput } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
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
/**
 * 서버 확정 실패 메시지를 화면에 낼 문장으로 정리한다.
 * - class-validator 는 message 를 **배열**로 준다(길이 초과 등) → 합쳐야 한다.
 *   배열을 그대로 넘기면 아무것도 안 보인다.
 * - 서버 문구는 영어라 알려진 케이스는 우리말로 바꿔 준다.
 */
function commitErrorMessage(error: any, t: (key: string) => string): string {
  const raw = error?.response?.data?.message;
  const text = Array.isArray(raw) ? raw.join("\n") : raw;

  if (text === "No changes to commit against the primary version") {
    return t("확정할 변경이 없습니다. 이미 최신 내용이 확정되어 있어요.");
  }
  return text || t("문서확정에 실패했습니다");
}

export default function CommitDialog({ pageId }: CommitDialogProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useAtom(commitDialogOpenAtom);
  const activeWorkingDoc = useAtomValue(activeWorkingDocAtom);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const commitMutation = useCommitVersionMutation(pageId);

  const workingDocId =
    activeWorkingDoc?.pageId === pageId
      ? activeWorkingDoc.workingDocId
      : undefined;

  // 다시 열 때 지난 실패가 남아 있지 않게
  useEffect(() => {
    if (opened) setError(null);
  }, [opened]);

  const handleCommit = async () => {
    // Enter 와 버튼이 각각 발사돼 두 번 확정되면, 두 번째는 "변경 없음" 400 이
    // 된다(QA 가 본 400 두 건의 정체). 진행 중에는 무시한다.
    if (commitMutation.isPending) return;

    setError(null);
    try {
      await commitMutation.mutateAsync({
        pageId,
        workingDocId,
        message: message.trim() || undefined,
      });
      setMessage("");
      setOpened(false);
    } catch (err) {
      // 실패하면 모달을 닫지 않고 여기서 이유를 보여준다
      setError(commitErrorMessage(err, t));
    }
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
        onChange={(e) => {
          setMessage(e.currentTarget.value);
          if (error) setError(null);
        }}
        maxLength={500}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            handleCommit();
          }
        }}
      />

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          variant="light"
          mt="sm"
          p="xs"
        >
          <Text size="xs" style={{ whiteSpace: "pre-line" }}>
            {error}
          </Text>
        </Alert>
      )}

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
