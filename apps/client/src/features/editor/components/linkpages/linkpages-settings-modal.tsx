import {
  Modal,
  Tabs,
  Button,
  Group,
  Checkbox,
  Text,
  Stack,
  Loader,
  UnstyledButton,
  Box,
} from "@mantine/core";
import { IconChevronRight, IconChevronDown, IconFileDescription } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import { useGetSidebarPagesQuery } from "@/features/page/queries/page-query";

interface Props {
  opened: boolean;
  onClose: () => void;
  selectedPageIds: string[];
  onSave: (pageIds: string[]) => void;
}

export function LinkpagesSettingsModal({
  opened,
  onClose,
  selectedPageIds,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(selectedPageIds),
  );

  useEffect(() => {
    setSelected(new Set(selectedPageIds));
  }, [selectedPageIds]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Select pages")}
      size="md"
      centered
    >
      <Tabs defaultValue="current">
        <Tabs.List mb="sm">
          <Tabs.Tab value="current">{t("Current space")}</Tabs.Tab>
          <Tabs.Tab value="all">{t("All spaces")}</Tabs.Tab>
        </Tabs.List>

        <Box mih={300} mah={450} style={{ overflowY: "auto" }}>
          <Tabs.Panel value="current">
            <CurrentSpaceTree selected={selected} toggle={toggle} />
          </Tabs.Panel>
          <Tabs.Panel value="all">
            <AllSpacesTree selected={selected} toggle={toggle} />
          </Tabs.Panel>
        </Box>
      </Tabs>

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          {t("Cancel")}
        </Button>
        <Button onClick={() => onSave(Array.from(selected))}>
          {t("Save")}
        </Button>
      </Group>
    </Modal>
  );
}

// ------ Current Space Tree ------

function CurrentSpaceTree({
  selected,
  toggle,
}: {
  selected: Set<string>;
  toggle: (id: string) => void;
}) {
  const { spaceSlug } = useParams();
  const { data: spaceData } = useGetSidebarPagesQuery(
    spaceSlug ? { spaceId: spaceSlug } : null,
  );

  const rootPages = useMemo(() => {
    if (!spaceData?.pages) return [];
    return spaceData.pages.flatMap((p) => p.items);
  }, [spaceData]);

  if (rootPages.length === 0) {
    return <Loader size="sm" />;
  }

  return (
    <Stack gap={0}>
      {rootPages.map((page) => (
        <PageTreeNode
          key={page.id}
          page={page}
          depth={0}
          selected={selected}
          toggle={toggle}
          defaultOpen={false}
        />
      ))}
    </Stack>
  );
}

// ------ All Spaces Tree ------

function AllSpacesTree({
  selected,
  toggle,
}: {
  selected: Set<string>;
  toggle: (id: string) => void;
}) {
  const { data } = useGetSpacesQuery({ limit: 100 });
  const spaces = data?.items ?? [];

  if (spaces.length === 0) {
    return <Loader size="sm" />;
  }

  return (
    <Stack gap={0}>
      {spaces.map((space) => (
        <SpaceNode
          key={space.id}
          space={space}
          selected={selected}
          toggle={toggle}
        />
      ))}
    </Stack>
  );
}

function SpaceNode({
  space,
  selected,
  toggle,
}: {
  space: { id: string; name: string; slug: string };
  selected: Set<string>;
  toggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <UnstyledButton
        onClick={() => setOpen((v) => !v)}
        py={4}
        px={4}
        style={{ borderRadius: 4 }}
      >
        <Group gap={4}>
          {open ? (
            <IconChevronDown size={14} />
          ) : (
            <IconChevronRight size={14} />
          )}
          <Text size="sm" fw={600}>
            {space.name}
          </Text>
        </Group>
      </UnstyledButton>
      {open && (
        <SpacePages
          spaceId={space.id}
          selected={selected}
          toggle={toggle}
        />
      )}
    </>
  );
}

function SpacePages({
  spaceId,
  selected,
  toggle,
}: {
  spaceId: string;
  selected: Set<string>;
  toggle: (id: string) => void;
}) {
  const { data, isLoading } = useGetSidebarPagesQuery({ spaceId });

  const rootPages = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.items);
  }, [data]);

  if (isLoading) {
    return (
      <Box pl={24} py={4}>
        <Loader size="xs" />
      </Box>
    );
  }

  return (
    <Stack gap={0} pl={12}>
      {rootPages.map((page) => (
        <PageTreeNode
          key={page.id}
          page={page}
          depth={0}
          selected={selected}
          toggle={toggle}
          defaultOpen={false}
        />
      ))}
    </Stack>
  );
}

// ------ Shared PageTreeNode ------

interface PageLike {
  id: string;
  title: string;
  icon?: string | null;
  hasChildren?: boolean;
}

function PageTreeNode({
  page,
  depth,
  selected,
  toggle,
  defaultOpen,
}: {
  page: PageLike;
  depth: number;
  selected: Set<string>;
  toggle: (id: string) => void;
  defaultOpen: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = (page as any).hasChildren ?? false;

  return (
    <>
      <Group
        gap={4}
        py={3}
        pl={depth * 16}
        wrap="nowrap"
        style={{ cursor: "pointer", borderRadius: 4 }}
      >
        {hasChildren ? (
          <UnstyledButton onClick={() => setOpen((v) => !v)} p={0}>
            {open ? (
              <IconChevronDown size={14} />
            ) : (
              <IconChevronRight size={14} />
            )}
          </UnstyledButton>
        ) : (
          <Box w={14} />
        )}

        <Checkbox
          size="xs"
          checked={selected.has(page.id)}
          onChange={() => toggle(page.id)}
        />

        {page.icon ? (
          <Text size="sm" component="span">
            {page.icon}
          </Text>
        ) : (
          <IconFileDescription size={16} color="gray" />
        )}

        <Text size="sm" lineClamp={1} style={{ flex: 1 }}>
          {page.title || t("untitled")}
        </Text>
      </Group>

      {open && hasChildren && (
        <LazyChildren
          pageId={page.id}
          depth={depth + 1}
          selected={selected}
          toggle={toggle}
        />
      )}
    </>
  );
}

function LazyChildren({
  pageId,
  depth,
  selected,
  toggle,
}: {
  pageId: string;
  depth: number;
  selected: Set<string>;
  toggle: (id: string) => void;
}) {
  const { data, isLoading } = useGetSidebarPagesQuery({ pageId });

  const children = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.items);
  }, [data]);

  if (isLoading) {
    return (
      <Box pl={(depth + 1) * 16} py={2}>
        <Loader size="xs" />
      </Box>
    );
  }

  return (
    <Stack gap={0}>
      {children.map((child) => (
        <PageTreeNode
          key={child.id}
          page={child}
          depth={depth}
          selected={selected}
          toggle={toggle}
          defaultOpen={false}
        />
      ))}
    </Stack>
  );
}
