import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Group,
  HoverCard,
  Image,
  Loader,
  Menu,
  Modal,
  Radio,
  Stack,
  Text,
} from "@mantine/core";
import {
  IconDots,
  IconDownload,
  IconFile,
  IconPhoto,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getFileUrl } from "@/lib/config.ts";
import { editorPageId } from "@/features/editor/atoms/editor-atoms.ts";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { uploadFile } from "@/features/page/services/page-service.ts";
import {
  useComponentsBulkQuery,
  useUploadRevisionMutation,
} from "@/features/component/queries/component-query.ts";
import { IComponentInstanceAttrs } from "@/features/component/types/component.types.ts";
import {
  componentPath,
  detachInstanceNode,
  updateInstancesInDoc,
} from "@/features/component/utils/instance-utils.ts";
import classes from "./component-instance-view.module.css";

function formatSize(size: number | null) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 문서 안 컴포넌트 인스턴스.
 * - 사본(src·revision)으로 그린다 — 확정 버전·공유 화면도 같은 모습.
 * - 편집 중이면 컴포넌트의 현재 상태를 함께 본다: 새 리비전이 있으면 «업데이트»,
 *   빈 자리에 이미 파일이 올라왔으면 미리보기와 «채우기».
 */
export default function ComponentInstanceView(props: NodeViewProps) {
  const { node, editor, selected, updateAttributes } = props;
  const attrs = node.attrs as IComponentInstanceAttrs & {
    align?: string;
  };
  const { t } = useTranslation();
  const editable = editor.isEditable;

  const pageId = editorPageId(editor);
  // 공유 화면(비로그인)에서는 조회하지 않는다 — 사본만으로 그린다
  const isShareRoute =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/share");
  const { data: page } = usePageQuery({
    pageId: isShareRoute ? undefined : (pageId ?? undefined),
  });
  const { data: live } = useComponentsBulkQuery(
    isShareRoute ? undefined : page?.spaceId,
    attrs.componentId ? [attrs.componentId] : [],
  );
  const current = live?.find((c) => c.id === attrs.componentId);

  const uploadRevision = useUploadRevisionMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [choice, setChoice] = useState<"revision" | "local">("revision");
  const [busy, setBusy] = useState(false);

  const isEmpty = !attrs.src || !attrs.revision;
  const hasUpdate =
    !!current && !isEmpty && current.currentRevision > attrs.revision;
  const canFill = !!current && isEmpty && current.currentRevision > 0;
  const spaceSlug = page?.space?.slug;

  const applyEverywhereInDoc = (next: IComponentInstanceAttrs) => {
    updateInstancesInDoc(editor, attrs.componentId, next);
  };

  const uploadAsRevision = async (file: File) => {
    setBusy(true);
    try {
      const result = await uploadRevision.mutateAsync({
        componentId: attrs.componentId,
        file,
      });
      applyEverywhereInDoc(result.component.instanceAttrs);
    } finally {
      setBusy(false);
    }
  };

  const replaceOnlyHere = async (file: File) => {
    if (!pageId) return;
    setBusy(true);
    try {
      const attachment = await uploadFile(file, pageId);
      detachInstanceNode(editor, props.getPos, attachment, attrs);
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (file: File | undefined | null) => {
    if (!file || !editable) return;
    if (isEmpty && !canFill) {
      // 빈 자리 — 묻지 않고 r1 로 올린다
      void uploadAsRevision(file);
      return;
    }
    setChoice("revision");
    setPendingFile(file);
  };

  const confirmChoice = async () => {
    const file = pendingFile;
    setPendingFile(null);
    if (!file) return;
    if (choice === "revision") await uploadAsRevision(file);
    else await replaceOnlyHere(file);
  };

  const onDrop = (e: React.DragEvent) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const badgeLabel = isEmpty
    ? `◇ ${attrs.slug ?? "component"} · Empty`
    : `◇ ${attrs.slug ?? "component"} · r${attrs.revision}`;

  const previewSrc = canFill ? current?.instanceAttrs.src : attrs.src;

  return (
    <NodeViewWrapper
      className={classes.wrapper}
      data-drag-handle
      data-align={attrs.align ?? "center"}
    >
      <div
        className={classes.box}
        data-selected={selected || undefined}
        data-empty={isEmpty || undefined}
        data-drag-over={dragOver || undefined}
        data-component-dropzone
        onDragOver={(e) => {
          if (!editable) return;
          if (!e.dataTransfer?.types?.includes("Files")) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <Group className={classes.topBar} gap={6} wrap="nowrap">
          <HoverCard
            width={300}
            shadow="md"
            openDelay={300}
            withinPortal
            position="bottom-start"
          >
            <HoverCard.Target>
              <Badge
                size="sm"
                radius="sm"
                variant="filled"
                color={isEmpty ? "orange" : "violet"}
                className={classes.badge}
              >
                {badgeLabel}
              </Badge>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <Stack gap={6}>
                <Text size="xs" c="dimmed">
                  {t("이 인스턴스의 컴포넌트")}
                </Text>
                <Text size="sm">
                  {t("Components")} › {current?.collectionName ?? "…"} ›{" "}
                  <b>{attrs.slug}</b>
                </Text>
                {attrs.description && (
                  <Text size="xs" c="dimmed">
                    {attrs.description}
                  </Text>
                )}
                {hasUpdate && (
                  <Text size="xs" c="orange.8">
                    {t("r{{a}} 사용 중 · r{{b}} 있음", {
                      a: attrs.revision,
                      b: current?.currentRevision,
                    })}
                  </Text>
                )}
                {spaceSlug && attrs.componentId && (
                  <Anchor
                    component={Link}
                    to={componentPath(spaceSlug, attrs.componentId)}
                    size="sm"
                  >
                    {t("컴포넌트 열기")}
                  </Anchor>
                )}
              </Stack>
            </HoverCard.Dropdown>
          </HoverCard>

          {editable && (
            <Menu position="bottom-end" withinPortal shadow="md">
              <Menu.Target>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label={t("인스턴스 메뉴")}
                  className={classes.menuButton}
                >
                  <IconDots size={14} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {spaceSlug && attrs.componentId && (
                  <Menu.Item
                    component={Link}
                    to={componentPath(spaceSlug, attrs.componentId)}
                  >
                    {t("컴포넌트 열기")}
                  </Menu.Item>
                )}
                <Menu.Item onClick={() => fileInputRef.current?.click()}>
                  {isEmpty ? t("파일 선택") : t("이미지 교체…")}
                </Menu.Item>
                {!isEmpty && (
                  <Menu.Item
                    color="red"
                    onClick={() =>
                      detachInstanceNode(editor, props.getPos, null, attrs)
                    }
                  >
                    {t("연결 끊기")}
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>

        {busy && (
          <Group justify="center" className={classes.busy}>
            <Loader size={18} />
            <Text size="sm">{t("올리는 중…")}</Text>
          </Group>
        )}

        {!busy && previewSrc && attrs.kind === "image" && (
          <Image
            src={getFileUrl(previewSrc)}
            alt={attrs.description ?? attrs.slug ?? ""}
            radius="sm"
            fit="contain"
            className={canFill ? classes.ghost : undefined}
          />
        )}

        {!busy && previewSrc && attrs.kind !== "image" && (
          <Group gap="sm" className={classes.fileCard} wrap="nowrap">
            <IconFile size={22} stroke={1.5} />
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={600} truncate>
                {(canFill ? current?.fileName : attrs.fileName) ?? attrs.slug}
              </Text>
              <Text size="xs" c="dimmed">
                {formatSize(
                  (canFill ? current?.fileSize : attrs.fileSize) ?? null,
                )}
              </Text>
            </Stack>
            <ActionIcon
              component="a"
              href={getFileUrl(previewSrc)}
              target="_blank"
              variant="subtle"
              aria-label={t("내려받기")}
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Group>
        )}

        {!busy && !previewSrc && (
          <Stack align="center" gap={6} className={classes.empty}>
            <IconPhoto size={26} stroke={1.5} />
            <Text size="sm" fw={600} ta="center">
              {attrs.description || t("에셋 없음")}
            </Text>
            {editable && (
              <Text size="xs" c="dimmed">
                {t("여기에 파일을 끌어다 놓거나")}{" "}
                <Anchor
                  component="button"
                  type="button"
                  size="xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t("파일 선택")}
                </Anchor>
              </Text>
            )}
          </Stack>
        )}

        {canFill && editable && (
          <Group className={classes.banner} gap="xs" wrap="nowrap">
            <Text size="xs" fw={600} style={{ flex: 1 }}>
              {t("r{{n}} 가 올라왔어요", { n: current?.currentRevision })}
            </Text>
            <Button
              size="compact-xs"
              onClick={() => applyEverywhereInDoc(current!.instanceAttrs)}
            >
              {t("채우기")}
            </Button>
          </Group>
        )}

        {hasUpdate && editable && (
          <Group className={classes.banner} gap="xs" wrap="nowrap">
            <Text size="xs" fw={600} style={{ flex: 1 }}>
              {t("r{{n}} 가 있어요", { n: current?.currentRevision })}
            </Text>
            <Button
              size="compact-xs"
              onClick={() => applyEverywhereInDoc(current!.instanceAttrs)}
            >
              {t("업데이트")}
            </Button>
          </Group>
        )}

        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept={attrs.kind === "image" ? "image/*" : undefined}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <Modal
        opened={!!pendingFile}
        onClose={() => setPendingFile(null)}
        title={t("이 이미지를 어떻게 바꿀까요?")}
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {t("새 파일")}: <b>{pendingFile?.name}</b>
          </Text>
          <Radio.Group
            value={choice}
            onChange={(v) => setChoice(v as "revision" | "local")}
          >
            <Stack gap="sm">
              <Radio
                value="revision"
                label={t("컴포넌트에 새 리비전으로 올리기")}
                description={`${t("Components")} › ${current?.collectionName ?? "…"} › ${attrs.slug} · r${current?.currentRevision ?? attrs.revision} → r${(current?.currentRevision ?? attrs.revision) + 1}. ${t("다른 문서에는 «업데이트 있음»이 뜨고, 예전 문서 버전은 그때의 리비전을 그대로 가리킵니다.")}`}
              />
              <Radio
                value="local"
                label={t("이 문서에서만 바꾸기")}
                description={t(
                  "연결을 끊고 일반 이미지로 교체합니다. 컴포넌트와 다른 문서는 그대로입니다.",
                )}
              />
            </Stack>
          </Radio.Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPendingFile(null)}>
              {t("취소")}
            </Button>
            <Button onClick={confirmChoice}>
              {choice === "revision"
                ? t("r{{n}}로 올리기", {
                    n: (current?.currentRevision ?? attrs.revision) + 1,
                  })
                : t("이 문서에서만 바꾸기")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </NodeViewWrapper>
  );
}
