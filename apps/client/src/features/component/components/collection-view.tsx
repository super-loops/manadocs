import { useState } from "react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Chip,
  Group,
  Menu,
  Modal,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from "@mantine/core";
import {
  IconDots,
  IconFile,
  IconLayoutGrid,
  IconList,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import { atomWithWebStorage } from "@/lib/jotai-helper.ts";
import { getFileUrl } from "@/lib/config.ts";
import {
  useComponentCollectionsQuery,
  useComponentsQuery,
  useDeleteCollectionMutation,
  useUpdateCollectionMutation,
} from "@/features/component/queries/component-query.ts";
import { IComponent } from "@/features/component/types/component.types.ts";
import { componentPath } from "@/features/component/utils/instance-utils.ts";
import RegisterComponentModal from "./register-component-modal.tsx";
import classes from "./collection-view.module.css";

const viewModeAtom = atomWithWebStorage<string>("components-view-mode", "grid");

type Filter = "all" | "image" | "file" | "empty";

interface Props {
  spaceId: string;
  spaceSlug: string;
  collectionId: string;
  canManage: boolean;
}

function Thumb({ c, height }: { c: IComponent; height: number }) {
  const { t } = useTranslation();
  if (c.empty) {
    return (
      <Box className={classes.thumbEmpty} h={height}>
        <Text size="xs">{t("에셋 없음")}</Text>
      </Box>
    );
  }
  if (c.kind === "image" && c.instanceAttrs.src) {
    return (
      <Box
        className={classes.thumbImage}
        h={height}
        style={{ backgroundImage: `url("${getFileUrl(c.instanceAttrs.src)}")` }}
      />
    );
  }
  return (
    <Box className={classes.thumbFile} h={height}>
      <IconFile size={20} stroke={1.5} />
    </Box>
  );
}

/** 묶음 화면 — 그리드/목록으로 탐색하고, 등록·편집한다 */
export default function CollectionView({
  spaceId,
  spaceSlug,
  collectionId,
  canManage,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [debounced] = useDebouncedValue(query, 250);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const { data: collections } = useComponentCollectionsQuery(spaceId);
  const collection = collections?.find((c) => c.id === collectionId);
  const { data: components } = useComponentsQuery({
    spaceId,
    collectionId,
    query: debounced || undefined,
  });
  const updateCollection = useUpdateCollectionMutation();
  const deleteCollection = useDeleteCollectionMutation();

  const all = components ?? [];
  const counts = {
    all: all.length,
    image: all.filter((c) => c.kind === "image").length,
    file: all.filter((c) => c.kind === "file").length,
    empty: all.filter((c) => c.empty).length,
  };
  const items = all.filter((c) =>
    filter === "all"
      ? true
      : filter === "empty"
        ? c.empty
        : c.kind === filter,
  );

  const openRegister = (file?: File | null) => {
    setDroppedFile(file ?? null);
    setRegisterOpen(true);
  };

  if (!collection) {
    return collections ? (
      <Text c="dimmed">{t("묶음을 찾을 수 없습니다")}</Text>
    ) : null;
  }

  const meta = (c: IComponent) =>
    c.empty
      ? t("Empty")
      : `${c.kind === "image" ? t("이미지") : t("파일")} · r${c.currentRevision}`;

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t("Components")} / {collection.name}
      </Text>
      <Group align="flex-end" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Title order={3}>{collection.name}</Title>
          {collection.description && (
            <Text size="sm" c="dimmed">
              {collection.description}
            </Text>
          )}
        </Stack>
        {canManage && (
          <>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <Button variant="default">{t("묶음 설정")}</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  onClick={() => {
                    setRenameValue(collection.name);
                    setRenameOpen(true);
                  }}
                >
                  {t("이름 바꾸기")}
                </Menu.Item>
                <Menu.Item
                  color="red"
                  disabled={collection.componentCount > 0}
                  onClick={async () => {
                    await deleteCollection.mutateAsync(collection.id);
                    navigate(`/s/${spaceSlug}`);
                  }}
                >
                  {collection.componentCount > 0
                    ? t("비어 있어야 지울 수 있습니다 ({{n}}개)", {
                        n: collection.componentCount,
                      })
                    : t("묶음 지우기")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Button
              color="violet"
              leftSection={<IconPlus size={16} />}
              onClick={() => openRegister()}
            >
              {t("컴포넌트 등록")}
            </Button>
          </>
        )}
      </Group>

      <Group gap="sm" wrap="wrap">
        <TextInput
          leftSection={<IconSearch size={14} />}
          placeholder={t("slug · 설명 검색")}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          w={260}
          aria-label={t("이 묶음에서 검색")}
        />
        <Chip.Group
          multiple={false}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        >
          <Group gap={6}>
            <Chip value="all" size="xs">
              {t("전체")} {counts.all}
            </Chip>
            <Chip value="image" size="xs">
              {t("이미지")} {counts.image}
            </Chip>
            <Chip value="file" size="xs">
              {t("파일")} {counts.file}
            </Chip>
            <Chip value="empty" size="xs" color="orange">
              {t("Empty")} {counts.empty}
            </Chip>
          </Group>
        </Chip.Group>
        <Box style={{ flex: 1 }} />
        <ActionIcon.Group>
          <ActionIcon
            variant={viewMode === "grid" ? "light" : "default"}
            size="lg"
            aria-label={t("그리드로 보기")}
            aria-pressed={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
          >
            <IconLayoutGrid size={16} />
          </ActionIcon>
          <ActionIcon
            variant={viewMode === "list" ? "light" : "default"}
            size="lg"
            aria-label={t("목록으로 보기")}
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
          >
            <IconList size={16} />
          </ActionIcon>
        </ActionIcon.Group>
      </Group>

      {viewMode === "grid" ? (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
          {canManage && (
            <UnstyledButton
              className={classes.newCard}
              data-drag-over={dragOver || undefined}
              onClick={() => openRegister()}
              onDragOver={(e) => {
                if (!e.dataTransfer?.types?.includes("Files")) return;
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                openRegister(e.dataTransfer.files?.[0]);
              }}
            >
              <IconPlus size={24} />
              <Text size="sm" fw={600}>
                {t("새 컴포넌트")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("파일을 끌어다 놓아도 등록")}
              </Text>
            </UnstyledButton>
          )}
          {items.map((c) => (
            <UnstyledButton
              key={c.id}
              component={Link}
              to={componentPath(spaceSlug, c.id)}
              className={classes.card}
            >
              <Thumb c={c} height={120} />
              <Text size="sm" fw={600} truncate mt={6}>
                {c.slug}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {c.description || "—"}
              </Text>
              <Text size="xs" c={c.empty ? "orange.8" : "dimmed"}>
                {meta(c)}
              </Text>
            </UnstyledButton>
          ))}
        </SimpleGrid>
      ) : (
        <Table highlightOnHover verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={90}>{t("미리보기")}</Table.Th>
              <Table.Th>slug</Table.Th>
              <Table.Th>{t("설명")}</Table.Th>
              <Table.Th w={90}>{t("종류")}</Table.Th>
              <Table.Th w={90}>{t("리비전")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((c) => (
              <Table.Tr
                key={c.id}
                className={classes.row}
                onClick={() => navigate(componentPath(spaceSlug, c.id))}
              >
                <Table.Td>
                  <Thumb c={c} height={40} />
                </Table.Td>
                <Table.Td>
                  <Anchor
                    component={Link}
                    to={componentPath(spaceSlug, c.id)}
                    fw={600}
                    size="sm"
                  >
                    {c.slug}
                  </Anchor>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {c.description || "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {c.kind === "image" ? t("이미지") : t("파일")}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {c.empty ? (
                    <Badge color="orange" variant="light" size="sm">
                      {t("Empty")}
                    </Badge>
                  ) : (
                    <Text size="sm">r{c.currentRevision}</Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {items.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          {query || filter !== "all"
            ? t("조건에 맞는 컴포넌트가 없습니다")
            : t("아직 컴포넌트가 없습니다")}
        </Text>
      )}

      <RegisterComponentModal
        opened={registerOpen}
        onClose={() => setRegisterOpen(false)}
        spaceId={spaceId}
        collectionId={collectionId}
        initialFile={droppedFile}
      />

      <Modal
        opened={renameOpen}
        onClose={() => setRenameOpen(false)}
        title={t("이름 바꾸기")}
        centered
      >
        <Stack gap="sm">
          <TextInput
            value={renameValue}
            onChange={(e) => setRenameValue(e.currentTarget.value)}
            data-autofocus
            aria-label={t("이름")}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRenameOpen(false)}>
              {t("취소")}
            </Button>
            <Button
              disabled={!renameValue.trim()}
              onClick={async () => {
                await updateCollection.mutateAsync({
                  collectionId,
                  name: renameValue.trim(),
                });
                setRenameOpen(false);
              }}
            >
              {t("저장")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
