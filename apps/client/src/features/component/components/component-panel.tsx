import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconFile,
  IconLayoutGrid,
  IconList,
  IconSearch,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { atomWithWebStorage } from "@/lib/jotai-helper.ts";
import { getFileUrl } from "@/lib/config.ts";
import { useComponentsQuery } from "@/features/component/queries/component-query.ts";
import { useDocInstances } from "@/features/component/hooks/use-doc-instances.ts";
import {
  COMPONENT_INSTANCE,
  updateInstancesInDoc,
} from "@/features/component/utils/instance-utils.ts";
import { IComponent } from "@/features/component/types/component.types.ts";
import classes from "./component-panel.module.css";

const panelViewAtom = atomWithWebStorage<string>("component-panel-view", "grid");

interface Props {
  spaceId: string;
}

/**
 * 오른쪽 Component 패널 — 위: 이 문서의 인스턴스(미니맵·묶음 경로·상태),
 * 아래: 스페이스 컴포넌트 검색과 «커서 위치에 넣기».
 */
export default function ComponentPanel({ spaceId }: Props) {
  const { t } = useTranslation();
  const { editor, instances } = useDocInstances(spaceId);
  const [query, setQuery] = useState("");
  const [debounced] = useDebouncedValue(query, 250);
  const [view, setView] = useAtom(panelViewAtom);
  const { data: results } = useComponentsQuery({
    spaceId,
    query: debounced || undefined,
  });
  const editable = !!editor?.isEditable;

  const scrollTo = (pos: number) => {
    if (!editor) return;
    editor.chain().setNodeSelection(pos).scrollIntoView().run();
  };

  const insert = (c: IComponent) => {
    if (!editor || !editable) return;
    editor
      .chain()
      .focus()
      .insertContent({ type: COMPONENT_INSTANCE, attrs: c.instanceAttrs })
      .run();
  };

  return (
    <Stack gap="md">
      <Stack gap={6}>
        <Text size="xs" fw={600} c="dimmed">
          {t("이 문서의 인스턴스 · {{n}}", { n: instances.length })}
        </Text>
        {instances.length === 0 ? (
          <Text size="xs" c="dimmed">
            {t("이 문서에는 아직 컴포넌트가 없습니다")}
          </Text>
        ) : (
          <Group align="stretch" gap="sm" wrap="nowrap">
            <Box className={classes.minimap} aria-label={t("문서 안 인스턴스 위치")}>
              {instances.map((i) => (
                <span
                  key={i.pos}
                  className={classes.mark}
                  data-empty={i.empty || undefined}
                  data-stale={i.stale || undefined}
                  style={{ top: `calc(${(i.ratio * 100).toFixed(1)}% - 5px)` }}
                />
              ))}
            </Box>
            <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
              {instances.map((i) => (
                <UnstyledButton
                  key={i.pos}
                  className={classes.instance}
                  data-attention={i.empty || i.stale || undefined}
                  onClick={() => scrollTo(i.pos)}
                >
                  <Group gap={6} wrap="nowrap">
                    <Text size="sm" fw={600} truncate style={{ flex: 1, minWidth: 0 }}>
                      {i.slug}
                    </Text>
                    {i.empty ? (
                      <Badge size="xs" color="orange" variant="light">
                        {i.canFill ? t("채울 수 있음") : "Empty"}
                      </Badge>
                    ) : i.stale ? (
                      <Badge size="xs" color="orange" variant="light">
                        r{i.revision} → r{i.component?.currentRevision}
                      </Badge>
                    ) : (
                      <Badge size="xs" color="teal" variant="light">
                        r{i.revision}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" truncate>
                    {i.component?.collectionName ?? "…"} · §{" "}
                    {i.heading ?? t("도입부")}
                  </Text>
                  {(i.stale || i.canFill) && editable && i.component && (
                    <Text
                      size="xs"
                      c="blue.7"
                      fw={600}
                      className={classes.inlineAction}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateInstancesInDoc(
                          editor!,
                          i.componentId,
                          i.component!.instanceAttrs,
                        );
                      }}
                    >
                      {i.canFill ? t("채우기") : t("업데이트")}
                    </Text>
                  )}
                </UnstyledButton>
              ))}
            </Stack>
          </Group>
        )}
      </Stack>

      <Box className={classes.divider} />

      <Stack gap={8}>
        <Group justify="space-between">
          <Text size="xs" fw={600} c="dimmed">
            {t("컴포넌트 넣기")}
          </Text>
          <ActionIcon.Group>
            <ActionIcon
              size="sm"
              variant={view === "grid" ? "light" : "default"}
              aria-label={t("그리드로 보기")}
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <IconLayoutGrid size={14} />
            </ActionIcon>
            <ActionIcon
              size="sm"
              variant={view === "list" ? "light" : "default"}
              aria-label={t("목록으로 보기")}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <IconList size={14} />
            </ActionIcon>
          </ActionIcon.Group>
        </Group>
        <TextInput
          size="xs"
          leftSection={<IconSearch size={14} />}
          placeholder={t("slug · 설명 검색")}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          aria-label={t("컴포넌트 검색")}
        />
        {view === "grid" ? (
          <SimpleGrid cols={2} spacing={8}>
            {(results ?? []).map((c) => (
              <ResultCard key={c.id} c={c} onInsert={insert} disabled={!editable} />
            ))}
          </SimpleGrid>
        ) : (
          <Stack gap={4}>
            {(results ?? []).map((c) => (
              <UnstyledButton
                key={c.id}
                className={classes.listRow}
                onClick={() => insert(c)}
                disabled={!editable}
              >
                <Text size="sm" fw={600} truncate style={{ flex: 1, minWidth: 0 }}>
                  {c.slug}
                </Text>
                <Text size="xs" c={c.empty ? "orange.8" : "dimmed"}>
                  {c.empty ? "Empty" : `r${c.currentRevision}`}
                </Text>
              </UnstyledButton>
            ))}
          </Stack>
        )}
        {(results ?? []).length === 0 && (
          <Text size="xs" c="dimmed">
            {t("조건에 맞는 컴포넌트가 없습니다")}
          </Text>
        )}
        {editable && (
          <Text size="xs" c="dimmed">
            {t("누르면 커서 위치에 인스턴스로 들어갑니다")}
          </Text>
        )}
      </Stack>
    </Stack>
  );
}

function ResultCard({
  c,
  onInsert,
  disabled,
}: {
  c: IComponent;
  onInsert: (c: IComponent) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Paper
      component="button"
      type="button"
      withBorder
      radius="md"
      p={6}
      className={classes.card}
      onClick={() => onInsert(c)}
      disabled={disabled}
    >
      {c.empty ? (
        <Box className={classes.thumbEmpty}>
          <Text size="xs">{t("에셋 없음")}</Text>
        </Box>
      ) : c.kind === "image" && c.instanceAttrs.src ? (
        <Box
          className={classes.thumb}
          style={{ backgroundImage: `url("${getFileUrl(c.instanceAttrs.src)}")` }}
        />
      ) : (
        <Box className={classes.thumbFile}>
          <IconFile size={18} />
        </Box>
      )}
      <Text size="xs" fw={600} truncate mt={4} ta="left">
        {c.slug}
      </Text>
      <Text size="xs" c={c.empty ? "orange.8" : "dimmed"} ta="left" truncate>
        {c.collectionName} · {c.empty ? "Empty" : `r${c.currentRevision}`}
      </Text>
    </Paper>
  );
}
