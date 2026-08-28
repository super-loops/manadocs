import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Loader, Text } from "@mantine/core";
import { useMemo } from "react";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";
import classes from "./video-view.module.css";
import { useTranslation } from "react-i18next";

export default function VideoView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor, node, selected } = props;
  const { src, width, align, aspectRatio, placeholder } = node.attrs;
  const alignClass = useMemo(() => {
    if (align === "left") return "alignLeft";
    if (align === "right") return "alignRight";
    if (align === "center") return "alignCenter";
    return "alignCenter";
  }, [align]);
  // 이 맵을 만들고 채우는 쪽은 업로드 확장(video-upload.ts)이다. 여기는 읽기만
  // 하면 되므로 «없으면 만들어 두기»를 하지 않는다 — useMemo 안에서 prop 을
  // 수정하게 되고(react-hooks/immutability), 만들어 봐야 바로 undefined 를
  // 읽을 뿐이다. 맵이 없을 때 결과가 undefined → null 로 바뀌지만 둘 다 falsy 라
  // 아래 `previewSrc &&` 렌더 분기는 그대로다.
  const previewSrc = useMemo(() => {
    if (!placeholder?.id) return null;
    return editor.storage.shared?.videoPreviews?.[placeholder.id] ?? null;
  }, [placeholder, editor]);

  return (
    <NodeViewWrapper data-drag-handle>
      <div
        className={clsx(
          selected && "ProseMirror-selectednode",
          classes.videoWrapper,
          !src && placeholder && classes.skeleton,
          alignClass,
        )}
        style={{
          aspectRatio: aspectRatio ? aspectRatio : src ? undefined : "16 / 9",
          width,
        }}
      >
        {src && (
          <video
            className={classes.video}
            preload="metadata"
            controls
            src={getFileUrl(src)}
          />
        )}
        {!src && previewSrc && (
          <Group pos="relative" h="100%" w="100%">
            <video
              className={classes.video}
              preload="metadata"
              controls
              src={previewSrc}
            />
            <Loader size={20} pos="absolute" top={6} right={6} />
          </Group>
        )}
        {!src && !previewSrc && placeholder && (
          <Group justify="center" wrap="nowrap" gap="xs" maw="100%" px="md">
            <Loader size={20} style={{ flexShrink: 0 }} />
            <Text component="span" size="sm" truncate="end">
              {placeholder?.name
                ? t("Uploading {{name}}", { name: placeholder.name })
                : t("Uploading file")}
            </Text>
          </Group>
        )}
        {!src && !previewSrc && !placeholder && (
          <video className={classes.video} controls />
        )}
      </div>
    </NodeViewWrapper>
  );
}
