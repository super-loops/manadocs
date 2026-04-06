import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  Stack,
  Text,
  Anchor,
  ActionIcon,
  Group,
} from "@mantine/core";
import { IconFileDescription, IconSettings } from "@tabler/icons-react";
import { useResolvePageIdsQuery } from "@/features/page/queries/page-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import classes from "./linkpages.module.css";
import styles from "../mention/mention.module.css";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { useTranslation } from "react-i18next";
import { LinkpagesSettingsModal } from "./linkpages-settings-modal";

export default function LinkpagesView(props: NodeViewProps) {
  const { editor, node, updateAttributes } = props;
  const { spaceSlug } = useParams();
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const pageIds: string[] = node.attrs.pageIds ?? [];

  const { data: resolved, isLoading } = useResolvePageIdsQuery(pageIds);

  // Maintain order from pageIds, filling in resolved data
  const pages = useMemo(() => {
    if (!resolved) return [];
    const map = new Map(resolved.map((p) => [p.id, p]));
    return pageIds
      .map((id) => map.get(id) ?? { id, slugId: "", title: null, icon: null, spaceId: "", deleted: true })
      .filter(Boolean);
  }, [resolved, pageIds]);

  const handleSave = (selectedIds: string[]) => {
    updateAttributes({ pageIds: selectedIds });
    setSettingsOpen(false);
  };

  if (pageIds.length === 0) {
    return (
      <NodeViewWrapper data-drag-handle>
        <div className={classes.container}>
          <Group justify="space-between" align="center">
            <Text c="dimmed" size="md" py="md">
              {t("No linked pages")}
            </Text>
            {editor.isEditable && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                opacity={0.4}
                onClick={() => setSettingsOpen(true)}
                contentEditable={false}
                className={classes.settingsBtn}
              >
                <IconSettings size={16} />
              </ActionIcon>
            )}
          </Group>
          {settingsOpen && (
            <LinkpagesSettingsModal
              opened={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              selectedPageIds={pageIds}
              onSave={handleSave}
            />
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  if (isLoading) {
    return null;
  }

  return (
    <NodeViewWrapper data-drag-handle>
      <div className={classes.container}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={5} style={{ flex: 1 }}>
            {pages.map((page) => (
              <Anchor
                key={page.id}
                component={Link}
                fw={500}
                to={
                  page.deleted || !page.slugId
                    ? "#"
                    : buildPageUrl(
                        (page as any).spaceSlug ?? spaceSlug,
                        page.slugId,
                        page.title,
                      )
                }
                underline="never"
                className={styles.pageMentionLink}
                draggable={false}
                style={page.deleted ? { textDecoration: "line-through", opacity: 0.5 } : undefined}
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
                  {page.deleted
                    ? page.title || page.id
                    : page?.title || t("untitled")}
                </span>
              </Anchor>
            ))}
          </Stack>

          {editor.isEditable && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              opacity={0.4}
              onClick={() => setSettingsOpen(true)}
              contentEditable={false}
              className={classes.settingsBtn}
            >
              <IconSettings size={16} />
            </ActionIcon>
          )}
        </Group>
        {settingsOpen && (
          <LinkpagesSettingsModal
            opened={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            selectedPageIds={pageIds}
            onSave={handleSave}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}
