import { useState } from "react";
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
import { useQuery } from "@tanstack/react-query";

export default function WorkspaceMcpPreview() {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [workspace] = useAtom(workspaceAtom);

  // 손으로 만든 캐시(펼치면 받고·받아두면 재사용·지시문 바뀌면 버림)를 그대로
  // react-query 에 맡긴다. 지시문을 키에 넣었으므로 바뀌면 저절로 새로 받는다.
  const {
    data: preview,
    isFetching: loading,
    refetch,
  } = useQuery<IMcpPreview>({
    queryKey: ["workspace-mcp-preview", workspace?.mcpInstructions],
    queryFn: getWorkspaceMcpPreview,
    enabled: opened,
  });

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
              <Button size="xs" variant="subtle" onClick={() => refetch()}>
                {t("Refresh")}
              </Button>
            </>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}
