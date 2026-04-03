import { useMemo, useState } from 'react';
import {
  Button,
  Table,
  Group,
  Modal,
  TextInput,
  MultiSelect,
  Stack,
  Text,
  Code,
  CopyButton,
  Tooltip,
  ActionIcon,
  Badge,
  Select,
  Tabs,
  Alert,
  SegmentedControl,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconCopy,
  IconCheck,
  IconTrash,
  IconPlus,
  IconLink,
  IconInfoCircle,
  IconPencil,
  IconRefresh,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGetSpacesQuery } from '@/features/space/queries/space-query.ts';
import { getAppName } from '@/lib/config.ts';
import { Helmet } from 'react-helmet-async';
import SettingsTitle from '@/components/settings/settings-title.tsx';
import { format } from 'date-fns';

type TokenType = 'mcp' | 'api' | 'both';
type SpaceScope = 'all' | 'selected';

interface TokenSpace {
  id: string;
  name: string | null;
  slug: string;
}

interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  tokenType: TokenType;
  permissions?: Record<string, boolean>;
  spaceScope: SpaceScope;
  spaces: TokenSpace[];
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateTokenResponse extends ApiToken {
  token: string;
}

const API_TOKENS_QUERY_KEY = ['api-tokens'];

const TOKEN_TYPE_COLOR: Record<TokenType, string> = {
  mcp: 'violet',
  api: 'blue',
  both: 'teal',
};

const TOKEN_TYPE_LABEL: Record<TokenType, string> = {
  mcp: 'MCP',
  api: 'API',
  both: 'MCP + API',
};

function getAppUrl(): string {
  return window.location.origin;
}

function CopyIconButton({ value }: { value: string }) {
  const { t } = useTranslation();
  return (
    <CopyButton value={value}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? t('Copied') : t('Copy')} withArrow>
          <ActionIcon
            size="sm"
            variant="subtle"
            color={copied ? 'teal' : 'gray'}
            onClick={copy}
          >
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}

function LinkModal({
  token,
  fullToken,
  opened,
  onClose,
}: {
  token: ApiToken | null;
  fullToken?: string | null;
  opened: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const appUrl = getAppUrl();

  if (!token) return null;

  const showMcp = token.tokenType === 'mcp' || token.tokenType === 'both';
  const showApi = token.tokenType === 'api' || token.tokenType === 'both';
  const tokenValue = fullToken ?? '<YOUR_TOKEN>';

  const mcpStreamableExample = `# Streamable HTTP (recommended)
# POST /mcp — send JSON-RPC (initialize, tools/list, tools/call, etc.)
curl -X POST ${appUrl}/api/mcp \\
  -H "Authorization: Bearer ${tokenValue}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"my-client","version":"1.0"}}}'

# GET /mcp — optional SSE notification channel (server → client)
curl -N ${appUrl}/api/mcp \\
  -H "Authorization: Bearer ${tokenValue}" \\
  -H "Mcp-Session-Id: <SESSION_ID>"

# DELETE /mcp — end session
curl -X DELETE ${appUrl}/api/mcp \\
  -H "Authorization: Bearer ${tokenValue}" \\
  -H "Mcp-Session-Id: <SESSION_ID>"`;

  const vscodeMcpJson = `// VS Code — .vscode/mcp.json (or User Settings → mcp.servers)
{
  "servers": {
    "manadocs": {
      "type": "http",
      "url": "${appUrl}/api/mcp",
      "headers": {
        "Authorization": "Bearer ${tokenValue}"
      }
    }
  }
}`;

  const mcpSseExample = `# SSE legacy (GET /mcp — establishes SSE stream for all JSON-RPC exchanges)
curl -N ${appUrl}/api/mcp \\
  -H "Authorization: Bearer ${tokenValue}"`;

  const vscodeMcpSseJson = `// VS Code — .vscode/mcp.json (SSE legacy transport)
{
  "servers": {
    "manadocs": {
      "type": "sse",
      "url": "${appUrl}/api/mcp",
      "headers": {
        "Authorization": "Bearer ${tokenValue}"
      }
    }
  }
}`;

  const apiExample = `# REST API — Bearer token authentication
curl ${appUrl}/api/pages \\
  -H "Authorization: Bearer ${tokenValue}"

# Create a page
curl -X POST ${appUrl}/api/pages \\
  -H "Authorization: Bearer ${tokenValue}" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "My Page", "spaceId": "<SPACE_ID>"}'`;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Integration Guide')}
      size="lg"
    >
      <Stack gap="md">
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          <Stack gap={6}>
            <Group gap="xs" wrap="nowrap" align="center">
              <Text size="sm" fw={600}>
                {t('Token')}:
              </Text>
              <Badge
                size="xs"
                color={TOKEN_TYPE_COLOR[token.tokenType]}
                variant="light"
              >
                {TOKEN_TYPE_LABEL[token.tokenType]}
              </Badge>
            </Group>
            {fullToken ? (
              <Group gap="xs" wrap="nowrap" align="center">
                <Code
                  style={{
                    wordBreak: 'break-all',
                    flex: 1,
                    padding: '4px 8px',
                  }}
                >
                  {fullToken}
                </Code>
                <CopyIconButton value={fullToken} />
              </Group>
            ) : (
              <Text size="xs" c="dimmed">
                {t(
                  'Full token is only shown once. Regenerate the token to obtain a new one.',
                )}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              {t('Space access')}:{' '}
              {token.spaceScope === 'all'
                ? t('All spaces')
                : (token.spaces ?? []).map((s) => s.name || s.slug).join(', ') ||
                  t('None')}
            </Text>
          </Stack>
        </Alert>

        {showMcp && (
          <Stack gap="xs">
            <Text fw={600} size="sm">
              {t('MCP Connection')}
            </Text>
            <Tabs defaultValue="streamable">
              <Tabs.List>
                <Tabs.Tab value="streamable">Streamable HTTP</Tabs.Tab>
                <Tabs.Tab value="sse">SSE Legacy</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="streamable" pt="xs">
                <Stack gap="xs">
                  <Group gap={4} justify="flex-end">
                    <CopyIconButton value={mcpStreamableExample} />
                  </Group>
                  <Code block style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                    {mcpStreamableExample}
                  </Code>
                  <Text size="xs" fw={600} c="dimmed" mt={4}>
                    {t('VS Code MCP configuration')}
                  </Text>
                  <Group gap={4} justify="flex-end">
                    <CopyIconButton value={vscodeMcpJson} />
                  </Group>
                  <Code block style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                    {vscodeMcpJson}
                  </Code>
                </Stack>
              </Tabs.Panel>
              <Tabs.Panel value="sse" pt="xs">
                <Stack gap="xs">
                  <Group gap={4} justify="flex-end">
                    <CopyIconButton value={mcpSseExample} />
                  </Group>
                  <Code block style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                    {mcpSseExample}
                  </Code>
                  <Text size="xs" fw={600} c="dimmed" mt={4}>
                    {t('VS Code MCP configuration (SSE legacy)')}
                  </Text>
                  <Group gap={4} justify="flex-end">
                    <CopyIconButton value={vscodeMcpSseJson} />
                  </Group>
                  <Code block style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                    {vscodeMcpSseJson}
                  </Code>
                </Stack>
              </Tabs.Panel>
            </Tabs>
          </Stack>
        )}

        {showApi && (
          <Stack gap="xs">
            <Text fw={600} size="sm">
              {t('REST API')}
            </Text>
            <Group gap={4} justify="flex-end" mb={4}>
              <CopyIconButton value={apiExample} />
            </Group>
            <Code block style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
              {apiExample}
            </Code>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}

const PERMISSION_KEYS = ['read', 'write', 'admin'];

function permissionsToList(p?: Record<string, boolean>): string[] {
  if (!p) return ['read'];
  return PERMISSION_KEYS.filter((k) => p[k]);
}

export default function ApiTokensPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [newToken, setNewToken] = useState<CreateTokenResponse | null>(null);
  const [tokenName, setTokenName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'read',
  ]);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [tokenType, setTokenType] = useState<TokenType>('api');
  const [spaceScope, setSpaceScope] = useState<SpaceScope>('all');
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);

  const [linkToken, setLinkToken] = useState<ApiToken | null>(null);
  const [linkFullToken, setLinkFullToken] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  // Edit modal state
  const [editToken, setEditToken] = useState<ApiToken | null>(null);
  const [editName, setEditName] = useState('');
  const [editPermissions, setEditPermissions] = useState<string[]>(['read']);
  const [editExpiresAt, setEditExpiresAt] = useState<Date | null>(null);
  const [editTokenType, setEditTokenType] = useState<TokenType>('api');
  const [editSpaceScope, setEditSpaceScope] = useState<SpaceScope>('all');
  const [editSpaceIds, setEditSpaceIds] = useState<string[]>([]);
  const [pendingRegenerate, setPendingRegenerate] = useState(false);

  const permissionOptions = useMemo(
    () => [
      { value: 'read', label: t('Read') },
      { value: 'write', label: t('Write') },
      { value: 'admin', label: t('Admin') },
    ],
    [t],
  );

  const tokenTypeOptions = [
    { value: 'api', label: 'API' },
    { value: 'mcp', label: 'MCP' },
    { value: 'both', label: 'MCP + API' },
  ];

  const { data: spacesPage } = useGetSpacesQuery({ limit: 100 });
  const spaceOptions = useMemo(
    () =>
      (spacesPage?.items ?? []).map((s) => ({
        value: s.id,
        label: s.name || s.slug,
      })),
    [spacesPage],
  );

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: API_TOKENS_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch('/api/api-tokens');
      if (!response.ok) throw new Error('Failed to fetch tokens');
      const body = await response.json();
      return body.data;
    },
  });

  const { mutate: createToken, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/api-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tokenName,
          permissions: selectedPermissions.reduce(
            (acc, perm) => ({ ...acc, [perm]: true }),
            {},
          ),
          expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
          tokenType,
          spaceScope,
          spaceIds: spaceScope === 'selected' ? selectedSpaceIds : undefined,
        }),
      });
      if (!response.ok) throw new Error('Failed to create token');
      const body = await response.json();
      return body.data;
    },
    onSuccess: (data: CreateTokenResponse) => {
      setNewToken(data);
      setOpened(false);
      queryClient.invalidateQueries({ queryKey: API_TOKENS_QUERY_KEY });
      // Open Integration Guide with full token
      setLinkToken(data);
      setLinkFullToken(data.token);
      setLinkModalOpen(true);
    },
  });

  const { mutate: deleteToken } = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/api-tokens/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete token');
      const body = await response.json();
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_TOKENS_QUERY_KEY });
    },
  });

  const { mutateAsync: updateTokenAsync, isPending: isUpdating } = useMutation({
    mutationFn: async (args: {
      id: string;
      name: string;
      permissions: Record<string, boolean>;
      expiresAt: string | null;
      tokenType: TokenType;
      spaceScope: SpaceScope;
      spaceIds: string[];
    }) => {
      const response = await fetch(`/api/api-tokens/${args.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: args.name,
          permissions: args.permissions,
          expiresAt: args.expiresAt,
          tokenType: args.tokenType,
          spaceScope: args.spaceScope,
          spaceIds:
            args.spaceScope === 'selected' ? args.spaceIds : undefined,
        }),
      });
      if (!response.ok) throw new Error('Failed to update token');
      const body = await response.json();
      return body.data as ApiToken;
    },
  });

  const { mutateAsync: regenerateTokenAsync, isPending: isRegenerating } =
    useMutation({
      mutationFn: async (id: string) => {
        const response = await fetch(`/api/api-tokens/${id}/regenerate`, {
          method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to regenerate token');
        const body = await response.json();
        return body.data as CreateTokenResponse;
      },
    });

  const handleCreateClick = () => {
    setTokenName('');
    setSelectedPermissions(['read']);
    setExpiresAt(null);
    setTokenType('api');
    setSpaceScope('all');
    setSelectedSpaceIds([]);
    setNewToken(null);
    setOpened(true);
  };

  const handleCreateSubmit = () => {
    if (!tokenName.trim()) return;
    if (spaceScope === 'selected' && selectedSpaceIds.length === 0) return;
    createToken();
  };

  const handleCloseCreateModal = () => {
    setOpened(false);
  };

  const handleLinkClick = (token: ApiToken) => {
    setLinkToken(token);
    setLinkFullToken(null);
    setLinkModalOpen(true);
  };

  const handleCloseLinkModal = () => {
    setLinkModalOpen(false);
    setLinkFullToken(null);
    setNewToken(null);
  };

  const handleEditClick = (token: ApiToken) => {
    setEditToken(token);
    setEditName(token.name);
    setEditPermissions(permissionsToList(token.permissions));
    setEditExpiresAt(token.expiresAt ? new Date(token.expiresAt) : null);
    setEditTokenType(token.tokenType ?? 'api');
    setEditSpaceScope(token.spaceScope ?? 'all');
    setEditSpaceIds((token.spaces ?? []).map((s) => s.id));
    setPendingRegenerate(false);
  };

  const handleCloseEditModal = () => {
    setEditToken(null);
    setPendingRegenerate(false);
  };

  const handleRegenerateClick = () => {
    if (
      confirm(
        t(
          'Regenerate this token? The current token will stop working once you press Save.',
        ),
      )
    ) {
      setPendingRegenerate(true);
    }
  };

  const handleEditSave = async () => {
    if (!editToken) return;
    if (!editName.trim()) return;

    try {
      if (editSpaceScope === 'selected' && editSpaceIds.length === 0) {
        return;
      }
      await updateTokenAsync({
        id: editToken.id,
        name: editName.trim(),
        permissions: editPermissions.reduce(
          (acc, perm) => ({ ...acc, [perm]: true }),
          {} as Record<string, boolean>,
        ),
        expiresAt: editExpiresAt ? editExpiresAt.toISOString() : null,
        tokenType: editTokenType,
        spaceScope: editSpaceScope,
        spaceIds: editSpaceIds,
      });

      let regenerated: CreateTokenResponse | null = null;
      if (pendingRegenerate) {
        regenerated = await regenerateTokenAsync(editToken.id);
      }

      queryClient.invalidateQueries({ queryKey: API_TOKENS_QUERY_KEY });
      handleCloseEditModal();

      if (regenerated) {
        setLinkToken(regenerated);
        setLinkFullToken(regenerated.token);
        setLinkModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const rows = tokens.map((token: ApiToken) => (
    <Table.Tr key={token.id}>
      <Table.Td>
        <Text size="sm" fw={500}>
          {token.name}
        </Text>
      </Table.Td>
      <Table.Td>
        <Code>{token.tokenPrefix}...</Code>
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <Badge
            variant="light"
            color={TOKEN_TYPE_COLOR[token.tokenType ?? 'api']}
            size="sm"
          >
            {TOKEN_TYPE_LABEL[token.tokenType ?? 'api']}
          </Badge>
          <Badge
            variant="light"
            color={token.spaceScope === 'all' ? 'gray' : 'grape'}
            size="sm"
          >
            {token.spaceScope === 'all'
              ? t('Space all')
              : `${t('Space')} ${(token.spaces ?? []).length}`}
          </Badge>
        </Group>
      </Table.Td>
      <Table.Td>
        {token.lastUsedAt ? (
          format(new Date(token.lastUsedAt), 'PP HH:mm')
        ) : (
          <Text size="sm" c="dimmed">
            {t('Never')}
          </Text>
        )}
      </Table.Td>
      <Table.Td>{format(new Date(token.createdAt), 'PP')}</Table.Td>
      <Table.Td>
        {token.expiresAt ? (
          <Badge
            variant="light"
            color={new Date(token.expiresAt) < new Date() ? 'red' : 'gray'}
          >
            {format(new Date(token.expiresAt), 'PP')}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            {t('Never')}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          <Tooltip label={t('Integration guide')}>
            <ActionIcon
              color="blue"
              variant="light"
              size="sm"
              onClick={() => handleLinkClick(token)}
            >
              <IconLink size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Edit token')}>
            <ActionIcon
              color="gray"
              variant="light"
              size="sm"
              onClick={() => handleEditClick(token)}
            >
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Delete token')}>
            <ActionIcon
              color="red"
              variant="light"
              size="sm"
              onClick={() => {
                if (
                  confirm(t('Are you sure you want to delete this token?'))
                ) {
                  deleteToken(token.id);
                }
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <Helmet>
        <title>
          {t('API Tokens')} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t('API Tokens')} />

      <Group mb="lg">
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={handleCreateClick}
        >
          {t('Create Token')}
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Name')}</Table.Th>
            <Table.Th>{t('Token Prefix')}</Table.Th>
            <Table.Th>{t('Permission')}</Table.Th>
            <Table.Th>{t('Last Used')}</Table.Th>
            <Table.Th>{t('Created')}</Table.Th>
            <Table.Th>{t('Expires')}</Table.Th>
            <Table.Th>{t('Actions')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>

      {tokens.length === 0 && !isLoading && (
        <Text c="dimmed" ta="center" mt="lg">
          {t('No API tokens created yet')}
        </Text>
      )}

      {/* Create token modal */}
      <Modal
        opened={opened}
        onClose={handleCloseCreateModal}
        title={t('Create New API Token')}
      >
        <Stack gap="lg">
          <TextInput
            label={t('Token Name')}
            placeholder={t('e.g., Integration API key')}
            value={tokenName}
            onChange={(e) => setTokenName(e.currentTarget.value)}
            required
          />

          <Select
            label={t('Token Type')}
            data={tokenTypeOptions}
            value={tokenType}
            onChange={(v) => setTokenType((v as TokenType) ?? 'api')}
            description={
              tokenType === 'mcp'
                ? t('For MCP clients (Claude, Cursor, etc.)')
                : tokenType === 'api'
                  ? t('For REST API access')
                  : t('For both MCP and REST API access')
            }
          />

          <MultiSelect
            label={t('Permissions')}
            data={permissionOptions}
            value={selectedPermissions}
            onChange={setSelectedPermissions}
            placeholder={t('Select permissions')}
          />

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              {t('Space Access')}
            </Text>
            <SegmentedControl
              value={spaceScope}
              onChange={(v) => setSpaceScope(v as SpaceScope)}
              data={[
                { label: t('All spaces'), value: 'all' },
                { label: t('Selected'), value: 'selected' },
              ]}
            />
            {spaceScope === 'selected' && (
              <MultiSelect
                data={spaceOptions}
                value={selectedSpaceIds}
                onChange={setSelectedSpaceIds}
                placeholder={t('Select at least one space')}
                searchable
                error={
                  selectedSpaceIds.length === 0
                    ? t('At least one space is required')
                    : undefined
                }
              />
            )}
          </Stack>

          <DatePickerInput
            label={t('Expires At')}
            placeholder={t('Optional: Set expiration date')}
            value={expiresAt}
            onChange={(v) => setExpiresAt(v ? new Date(v) : null)}
            clearable
          />

          <Group justify="flex-end" gap="xs">
            <Button variant="light" onClick={handleCloseCreateModal}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleCreateSubmit}
              loading={isCreating}
              disabled={
                !tokenName.trim() ||
                (spaceScope === 'selected' && selectedSpaceIds.length === 0)
              }
            >
              {t('Create')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit token modal */}
      <Modal
        opened={!!editToken}
        onClose={handleCloseEditModal}
        title={t('Edit API Token')}
      >
        <Stack gap="lg">
          <TextInput
            label={t('Token Name')}
            value={editName}
            onChange={(e) => setEditName(e.currentTarget.value)}
            required
          />

          <Select
            label={t('Token Type')}
            data={tokenTypeOptions}
            value={editTokenType}
            onChange={(v) => setEditTokenType((v as TokenType) ?? 'api')}
          />

          <MultiSelect
            label={t('Permissions')}
            data={permissionOptions}
            value={editPermissions}
            onChange={setEditPermissions}
            placeholder={t('Select permissions')}
          />

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              {t('Space Access')}
            </Text>
            <SegmentedControl
              value={editSpaceScope}
              onChange={(v) => setEditSpaceScope(v as SpaceScope)}
              data={[
                { label: t('All spaces'), value: 'all' },
                { label: t('Selected'), value: 'selected' },
              ]}
            />
            {editSpaceScope === 'selected' && (
              <MultiSelect
                data={spaceOptions}
                value={editSpaceIds}
                onChange={setEditSpaceIds}
                placeholder={t('Select at least one space')}
                searchable
                error={
                  editSpaceIds.length === 0
                    ? t('At least one space is required')
                    : undefined
                }
              />
            )}
          </Stack>

          <DatePickerInput
            label={t('Expires At')}
            placeholder={t('Optional: Set expiration date')}
            value={editExpiresAt}
            onChange={(v) => setEditExpiresAt(v ? new Date(v) : null)}
            clearable
          />

          <Stack gap="xs">
            <Button
              variant="light"
              color={pendingRegenerate ? 'orange' : 'gray'}
              leftSection={<IconRefresh size={16} />}
              onClick={handleRegenerateClick}
              disabled={pendingRegenerate}
            >
              {pendingRegenerate
                ? t('Will regenerate on Save')
                : t('Regenerate Token')}
            </Button>
            {pendingRegenerate && (
              <Text size="xs" c="orange">
                {t(
                  'Token will be regenerated when you click Save. The current token will stop working.',
                )}
              </Text>
            )}
          </Stack>

          <Group justify="flex-end" gap="xs">
            <Button variant="light" onClick={handleCloseEditModal}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleEditSave}
              loading={isUpdating || isRegenerating}
              disabled={
                !editName.trim() ||
                (editSpaceScope === 'selected' && editSpaceIds.length === 0)
              }
            >
              {t('Save')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Link / Integration guide modal */}
      <LinkModal
        token={linkToken}
        fullToken={linkFullToken}
        opened={linkModalOpen}
        onClose={handleCloseLinkModal}
      />
    </>
  );
}
