import { useEffect, useState } from "react";
import {
  Button,
  Code,
  Collapse,
  Group,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  getWorkspaceMcpPreview,
  IMcpPreview,
} from "@/features/workspace/services/workspace-service.ts";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useAtom } from "jotai";

export default function WorkspaceMcpPreview() {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [preview, setPreview] = useState<IMcpPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [workspace] = useAtom(workspaceAtom);

  useEffect(() => {
    if (opened && !preview) {
      setLoading(true);
      getWorkspaceMcpPreview()
        .then(setPreview)
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [opened, preview]);

  useEffect(() => {
    // reset cache when instructions change
    setPreview(null);
  }, [workspace?.mcpInstructions]);

  return (
    <Paper withBorder p="md" mt="md" radius="sm">
      <Group
        justify="space-between"
        style={{ cursor: "pointer" }}
        onClick={() => setOpened((o) => !o)}
      >
        <Group gap="xs">
          {opened ? (
            <IconChevronDown size={16} />
          ) : (
            <IconChevronRight size={16} />
          )}
          <Text fw={500}>{t("MCP preview")}</Text>
        </Group>
        <Text size="xs" c="dimmed">
          {t("Shows compiled system prompt and available tools")}
        </Text>
      </Group>

      <Collapse in={opened}>
        <Stack mt="md" gap="md">
          {loading && <Text size="sm">{t("Loading")}...</Text>}
          {preview && (
            <>
              <div>
                <Text size="sm" fw={500} mb="xs">
                  {t("System prompt")}
                </Text>
                <Code block style={{ whiteSpace: "pre-wrap" }}>
                  {preview.prompt}
                </Code>
              </div>
              <div>
                <Text size="sm" fw={500} mb="xs">
                  {t("Available tools")} ({preview.tools.length})
                </Text>
                <Stack gap="xs">
                  {preview.tools.map((tool) => (
                    <Paper key={tool.name} withBorder p="xs" radius="sm">
                      <Text size="sm" fw={500} ff="monospace">
                        {tool.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {tool.description}
                      </Text>
                    </Paper>
                  ))}
                </Stack>
              </div>
              <Button
                size="xs"
                variant="subtle"
                onClick={() => setPreview(null)}
              >
                {t("Refresh")}
              </Button>
            </>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}
