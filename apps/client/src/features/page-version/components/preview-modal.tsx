import { Badge, Button, Group, Modal, Text } from "@mantine/core";
import { IconExternalLink, IconWorld } from "@tabler/icons-react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor";
import { previewVersionIdAtom } from "@/features/page-version/atoms/page-version-atoms";
import { usePageVersionQuery } from "@/features/page-version/queries/page-version-query";
import { readOnlyEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { useReviewAnchorDecorations } from "@/features/editor/components/review/use-review-anchor-decorations";
import { sharePrefillAtom } from "@/features/share/atoms/share-prefill-atom.ts";
import { buildVersionViewUrl } from "@/features/page-version/utils/version-view-url";

/**
 * 미리보기 모달 — 임의 버전을 reader 시점(정적 렌더)으로 본다.
 * 여기서 바로 새 창(헤더·사이드바 없는 읽기 화면)으로 넘어가거나,
 * 이 버전으로 고정된 공유 링크 발급 폼을 열 수 있다.
 */
export default function PreviewModal() {
  const { t } = useTranslation();
  const { spaceSlug, pageSlug } = useParams();
  const [previewVersionId, setPreviewVersionId] = useAtom(previewVersionIdAtom);
  const { data: version } = usePageVersionQuery(previewVersionId);
  const readonlyEditor = useAtomValue(readOnlyEditorAtom);
  const setSharePrefill = useSetAtom(sharePrefillAtom);
  // 확정본 위 리뷰 앵커 오버레이 (이 버전에 존재하는 블록에만)
  useReviewAnchorDecorations(
    readonlyEditor,
    version?.pageId,
    !!previewVersionId,
  );

  const viewUrl =
    version && spaceSlug && pageSlug
      ? buildVersionViewUrl(spaceSlug, pageSlug, version.version)
      : null;
  // 버전 0(생성 마커)은 내용이 없어 공유 대상이 아니다
  const canShareVersion = !!version && version.version > 0;

  const handleShareThisVersion = () => {
    if (!version) return;
    setSharePrefill({
      pageId: version.pageId,
      fixedVersionId: version.id,
    });
    // 공유 팝오버는 헤더에 있다 — 모달을 비켜줘야 보인다
    setPreviewVersionId(null);
  };

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
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
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

          <Group gap="xs" wrap="nowrap">
            {viewUrl && (
              <Button
                size="compact-xs"
                variant="default"
                component="a"
                href={viewUrl}
                target="_blank"
                rel="noopener"
                leftSection={<IconExternalLink size={14} />}
              >
                {t("새 창에서 보기")}
              </Button>
            )}
            {canShareVersion && (
              <Button
                size="compact-xs"
                variant="default"
                leftSection={<IconWorld size={14} />}
                onClick={handleShareThisVersion}
              >
                {t("이 버전 공유")}
              </Button>
            )}
            <Modal.CloseButton />
          </Group>
        </Modal.Header>
        <Modal.Body>
          <Text size="xs" c="dimmed" mb="sm">
            {t("독자와 공유 링크에 보이는 화면 그대로입니다")}
          </Text>
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
