import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Text, Paper, ActionIcon, Loader, Tooltip } from "@mantine/core";
import { getFileUrl } from "@/lib/config.ts";
import { IconDownload, IconFileTypePdf, IconPaperclip } from "@tabler/icons-react";
import { useHover } from "@mantine/hooks";
import { formatBytes } from "@/lib";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";

export default function AttachmentView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor, node, getPos, selected } = props;
  const { url, name, size, mime, attachmentId, placeholder } = node.attrs;
  const { hovered, ref } = useHover();

  const isPdf = mime === "application/pdf" || name?.toLowerCase().endsWith(".pdf");

  const handleEmbedAsPdf = useCallback(() => {
    const pos = getPos();
    if (pos === undefined || !url) return;

    const nodeSize = node.nodeSize;

    editor
      .chain()
      .insertContentAt(
        { from: pos, to: pos + nodeSize },
        {
          type: "pdf",
          attrs: {
            src: url,
            name,
            attachmentId,
            size,
          },
        },
      )
      .run();
  // size 는 node.attrs 에서 온 값이라 node 가 바뀔 때만 바뀐다 — 이미 deps 에
  // 있는 node 보다 자주 무효화될 수 없다.
  }, [editor, getPos, node, url, name, attachmentId, size]);

  return (
    <NodeViewWrapper>
      <Paper withBorder p="4px" ref={ref} data-drag-handle>
        <Group
          justify="space-between"
          gap="xl"
          style={{ cursor: "pointer" }}
          wrap="nowrap"
          h={25}
        >
          <Group wrap="nowrap" gap="sm" style={{ minWidth: 0, flex: 1 }}>
            {!url && placeholder ? (
              <Loader size={20} style={{ flexShrink: 0 }} />
            ) : (
              <IconPaperclip size={20} style={{ flexShrink: 0 }} />
            )}

            <Text component="span" size="md" truncate="end" style={{ minWidth: 0 }}>
              {!url && placeholder ? t("Uploading {{name}}", { name }) : name}
            </Text>

            <Text component="span" size="sm" c="dimmed" style={{ flexShrink: 0 }}>
              {formatBytes(size)}
            </Text>
          </Group>

          {url && (selected || hovered) && (
            <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
              {isPdf && editor.isEditable && (
                <Tooltip label={t("Embed as PDF")} position="top" withinPortal={false}>
                  <ActionIcon variant="default" aria-label={t("Embed as PDF")} onClick={handleEmbedAsPdf}>
                    <IconFileTypePdf size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
              <a href={getFileUrl(url)} target="_blank">
                <ActionIcon variant="default" aria-label="download file">
                  <IconDownload size={18} />
                </ActionIcon>
              </a>
            </Group>
          )}
        </Group>
      </Paper>
    </NodeViewWrapper>
  );
}
