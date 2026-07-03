import { Badge, Group, Modal, Text } from "@mantine/core";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor";
import { previewVersionIdAtom } from "@/features/page-version/atoms/page-version-atoms";
import { usePageVersionQuery } from "@/features/page-version/queries/page-version-query";
import { readOnlyEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { useReviewAnchorDecorations } from "@/features/editor/components/review/use-review-anchor-decorations";

/**
 * 미리보기 모달 — 임의 버전을 reader 시점(정적 렌더)으로 본다.
 */
export default function PreviewModal() {
  const { t } = useTranslation();
  const [previewVersionId, setPreviewVersionId] = useAtom(previewVersionIdAtom);
  const { data: version } = usePageVersionQuery(previewVersionId);
  const readonlyEditor = useAtomValue(readOnlyEditorAtom);
  // 확정본 위 리뷰 앵커 오버레이 (이 버전에 존재하는 블록에만)
  useReviewAnchorDecorations(
    readonlyEditor,
    version?.pageId,
    !!previewVersionId,
  );

  return (
    <Modal.Root
      opened={!!previewVersionId}
      onClose={() => setPreviewVersionId(null)}
      size={1000}
      padding="lg"
      yOffset="5vh"
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflowY: "auto", height: "90vh" }}>
        <Modal.Header py={0}>
          <Group gap="xs">
            <Modal.Title>
              <Text fw={600}>{t("미리보기")}</Text>
            </Modal.Title>
            {version && (
              <>
                <Badge size="sm" variant="light" color="blue" radius="sm">
                  {t("버전 {{n}}", { n: version.version })}
                </Badge>
                {version.message && (
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {version.message}
                  </Text>
                )}
              </>
            )}
          </Group>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
          {version && (
            <ReadonlyPageEditor
              key={version.id}
              title={version.title ?? ""}
              content={version.content}
            />
          )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
