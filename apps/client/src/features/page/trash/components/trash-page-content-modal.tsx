import { Modal, Text, ScrollArea } from "@mantine/core";
import { useTranslation } from "react-i18next";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";

interface Props {
  opened: boolean;
  onClose: () => void;
  pageTitle: string;
  pageContent: any;
}

export default function TrashPageContentModal({
  opened,
  onClose,
  pageTitle,
  pageContent,
}: Props) {
  const { t } = useTranslation();
  const title = pageTitle || t("untitled");

  return (
    <Modal.Root size={1200} opened={opened} onClose={onClose}>
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Header>
          <Modal.Title>
            <Text size="md" fw={500}>
              {t("Preview")}
            </Text>
          </Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body p={0}>
          <ScrollArea h="650" w="100%" scrollbarSize={5}>
            {/* 휴지통 미리보기는 페이지 본문이 아니다 — 전역 atom 을 덮지 않는다 */}
            <ReadonlyPageEditor
              title={title}
              content={pageContent}
              publishAsPageEditor={false}
            />
          </ScrollArea>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
