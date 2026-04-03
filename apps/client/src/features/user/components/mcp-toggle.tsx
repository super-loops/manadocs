import { useState, useEffect } from 'react';
import { Group, Switch, Text, Stack, Loader } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

export default function McpToggle() {
  const { t } = useTranslation();
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch workspace settings
  const { data: workspace, isLoading } = useQuery({
    queryKey: ['workspace-settings'],
    queryFn: async () => {
      const response = await fetch('/api/workspace');
      if (!response.ok) throw new Error('Failed to fetch workspace');
      return response.json();
    },
  });

  useEffect(() => {
    if (workspace?.mcpEnabled !== undefined) {
      setMcpEnabled(workspace.mcpEnabled);
    }
  }, [workspace]);

  // Update workspace settings
  const { mutate: updateMcp } = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch('/api/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mcpEnabled: enabled }),
      });
      if (!response.ok) throw new Error('Failed to update MCP setting');
      return response.json();
    },
    onSuccess: () => {
      setIsUpdating(false);
    },
  });

  const handleToggle = (enabled: boolean) => {
    setMcpEnabled(enabled);
    setIsUpdating(true);
    updateMcp(enabled);
  };

  if (isLoading) {
    return <Loader size="sm" />;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Stack gap={0}>
          <Text fw={500}>{t('MCP (Model Context Protocol)')}</Text>
          <Text size="sm" c="dimmed">
            {t('Enable MCP to allow AI assistants to manage documents via API')}
          </Text>
        </Stack>
        <Switch
          checked={mcpEnabled}
          onChange={(e) => handleToggle(e.currentTarget.checked)}
          disabled={isUpdating}
        />
      </Group>
    </Stack>
  );
}
