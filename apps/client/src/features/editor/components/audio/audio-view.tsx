import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Loader, Text } from "@mantine/core";
import { useMemo } from "react";
import { getFileUrl } from "@/lib/config.ts";
import { isInternalFileUrl } from "@manadocs/editor-ext";
import classes from "./audio-view.module.css";
import { useTranslation } from "react-i18next";

export default function AudioView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor, node } = props;
  const { src, placeholder } = node.attrs;

  const safeSrc = useMemo(() => {
    if (!src || !isInternalFileUrl(src)) return null;
    return getFileUrl(src);
  }, [src]);

  // 이 맵을 만들고 채우는 쪽은 업로드 확장(audio-upload.ts)이다. 여기는 읽기만
  // 하면 되므로 «없으면 만들어 두기»를 하지 않는다 — useMemo 안에서 prop 을
  // 수정하게 되고(react-hooks/immutability), 만들어 봐야 바로 undefined 를
  // 읽을 뿐이다. 맵이 없을 때 결과가 undefined → null 로 바뀌지만 둘 다 falsy 라
  // 아래 `previewSrc &&` 렌더 분기는 그대로다.
  const previewSrc = useMemo(() => {
    if (!placeholder?.id) return null;
    return editor.storage.shared?.audioPreviews?.[placeholder.id] ?? null;
  }, [placeholder, editor]);

  return (
    <NodeViewWrapper data-drag-handle>
      <div className={`${classes.audioWrapper} ${!safeSrc && placeholder ? classes.skeleton : ''}`}>
        {safeSrc && (
          <audio
            className={classes.audio}
            preload="metadata"
            controls
            src={safeSrc}
          />
        )}
        {!safeSrc && previewSrc && (
          <Group pos="relative" w="100%">
            <audio
              className={classes.audio}
              preload="metadata"
              controls
              src={previewSrc}
            />
            <Loader size={20} pos="absolute" top={6} right={6} />
          </Group>
        )}
        {!safeSrc && !previewSrc && placeholder && (
          <Group justify="center" wrap="nowrap" gap="xs" maw="100%" px="md" h={54}>
            <Loader size={20} style={{ flexShrink: 0 }} />
            <Text component="span" size="sm" truncate="end">
              {placeholder?.name
                ? t("Uploading {{name}}", { name: placeholder.name })
                : t("Uploading file")}
            </Text>
          </Group>
        )}
        {!safeSrc && !previewSrc && !placeholder && (
          <audio className={classes.audio} controls />
        )}
      </div>
    </NodeViewWrapper>
  );
}
