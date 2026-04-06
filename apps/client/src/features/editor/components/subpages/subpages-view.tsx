import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Stack, Text, Anchor, ActionIcon, Popover, Checkbox, Group } from "@mantine/core";
import { IconFileDescription, IconSettings } from "@tabler/icons-react";
import { useGetSidebarPagesQuery } from "@/features/page/queries/page-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import classes from "./subpages.module.css";
import styles from "../mention/mention.module.css";
import {
  buildPageUrl,
  buildSharedPageUrl,
} from "@/features/page/page.utils.ts";
import { useTranslation } from "react-i18next";
import { sortPositionKeys } from "@/features/page/tree/utils/utils";
import { useSharedPageSubpages } from "@/features/share/hooks/use-shared-page-subpages";

export default function SubpagesView(props: NodeViewProps) {
  const { editor, node, updateAttributes } = props;
  const { spaceSlug, shareId } = useParams();
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const excludePageIds: string[] = node.attrs.excludePageIds ?? [];

  //@ts-ignore
  const currentPageId = editor.storage.pageId;

  const sharedSubpages = useSharedPageSubpages(currentPageId);

  const { data, isLoading, error } = useGetSidebarPagesQuery(
    shareId ? null : { pageId: currentPageId },
  );

  const allSubpages = useMemo(() => {
    if (shareId && sharedSubpages) {
      return sharedSubpages.map((node) => ({
        id: node.value,
        slugId: node.slugId,
        title: node.name,
        icon: node.icon,
        position: node.position,
      }));
    }
    if (!data?.pages) return [];
    const allPages = data.pages.flatMap((page) => page.items);
    return sortPositionKeys(allPages);
  }, [data, shareId, sharedSubpages]);

  const subpages = useMemo(() => {
    if (excludePageIds.length === 0) return allSubpages;
    const excluded = new Set(excludePageIds);
    return allSubpages.filter((p) => !excluded.has(p.id));
  }, [allSubpages, excludePageIds]);

  const toggleExclude = (pageId: string) => {
    const current = new Set(excludePageIds);
    if (current.has(pageId)) {
      current.delete(pageId);
    } else {
      current.add(pageId);
    }
    updateAttributes({ excludePageIds: Array.from(current) });
  };

  if (isLoading && !shareId) {
    return null;
  }

  if (error && !shareId) {
    return (
      <NodeViewWrapper data-drag-handle>
        <Text c="dimmed" size="md" py="md">
          {t("Failed to load subpages")}
        </Text>
      </NodeViewWrapper>
    );
  }

  if (allSubpages.length === 0) {
    return (
      <NodeViewWrapper data-drag-handle>
        <div className={classes.container}>
          <Text c="dimmed" size="md" py="md">
            {t("No subpages")}
          </Text>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-drag-handle>
      <div className={classes.container}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={5} style={{ flex: 1 }}>
            {subpages.map((page) => (
              <Anchor
                key={page.id}
                component={Link}
                fw={500}
                to={
                  shareId
                    ? buildSharedPageUrl({
                        shareId,
                        pageSlugId: page.slugId,
                        pageTitle: page.title,
                      })
                    : buildPageUrl(spaceSlug, page.slugId, page.title)
                }
                underline="never"
                className={styles.pageMentionLink}
                draggable={false}
              >
                {page?.icon ? (
                  <span style={{ marginRight: "4px" }}>{page.icon}</span>
                ) : (
                  <ActionIcon
                    variant="transparent"
                    color="gray"
                    component="span"
                    size={18}
                    style={{ verticalAlign: "text-bottom" }}
                  >
                    <IconFileDescription size={18} />
                  </ActionIcon>
                )}

                <span className={styles.pageMentionText}>
                  {page?.title || t("untitled")}
                </span>
              </Anchor>
            ))}
          </Stack>

          {editor.isEditable && (
            <Popover
              opened={settingsOpen}
              onChange={setSettingsOpen}
              position="bottom-end"
              width={260}
              shadow="md"
            >
              <Popover.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  opacity={0.4}
                  onClick={() => setSettingsOpen((v) => !v)}
                  contentEditable={false}
                  className={classes.settingsBtn}
                >
                  <IconSettings size={16} />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown>
                <Text size="xs" fw={600} mb="xs">
                  {t("Visible subpages")}
                </Text>
                <Stack gap={4}>
                  {allSubpages.map((page) => (
                    <Checkbox
                      key={page.id}
                      label={page.title || t("untitled")}
                      size="xs"
                      checked={!excludePageIds.includes(page.id)}
                      onChange={() => toggleExclude(page.id)}
                    />
                  ))}
                </Stack>
              </Popover.Dropdown>
            </Popover>
          )}
        </Group>
      </div>
    </NodeViewWrapper>
  );
}
