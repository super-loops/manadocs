import { useState } from 'react';
import {
  Table,
  Text,
  Badge,
  Group,
  Select,
  TextInput,
  Stack,
  Pagination,
  Tooltip,
  ActionIcon,
  Collapse,
  Code,
  Box,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconSearch, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getAppName } from '@/lib/config.ts';
import { Helmet } from 'react-helmet-async';
import SettingsTitle from '@/components/settings/settings-title.tsx';
import { format } from 'date-fns';

interface AuditEntry {
  id: string;
  workspaceId: string;
  actorId: string | null;
  actorType: string;
  event: string;
  resourceType: string;
  resourceId: string | null;
  spaceId: string | null;
  changes: Record<string, any> | null;
  metadata: Record<string, any> | null;
  ipAddress: string | null;
  createdAt: string;
}

const EVENT_COLOR: Record<string, string> = {
  created: 'green',
  deleted: 'red',
  updated: 'blue',
  login: 'teal',
  logout: 'gray',
  imported: 'violet',
  exported: 'violet',
  trashed: 'orange',
  restored: 'cyan',
};

function getEventColor(event: string): string {
  const suffix = event.split('.').pop() ?? '';
  return EVENT_COLOR[suffix] ?? 'gray';
}

const PAGE_SIZE = 50;

export default function AuditsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [event, setEvent] = useState<string | null>(null);
  const [resourceType, setResourceType] = useState<string | null>(null);
  const [actorId, setActorId] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const offset = (page - 1) * PAGE_SIZE;

  const params = new URLSearchParams();
  params.set('limit', String(PAGE_SIZE));
  params.set('offset', String(offset));
  if (event) params.set('event', event);
  if (resourceType) params.set('resourceType', resourceType);
  if (actorId.trim()) params.set('actorId', actorId.trim());
  if (startDate) params.set('startDate', startDate.toISOString());
  if (endDate) params.set('endDate', endDate.toISOString());

  const { data, isLoading } = useQuery({
    queryKey: ['audits', page, event, resourceType, actorId, startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`/api/audits?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch audits');
      return response.json() as Promise<{ items: AuditEntry[]; total: number }>;
    },
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const eventOptions = [
    { value: '', label: t('All events') },
    { value: 'workspace.created', label: 'workspace.created' },
    { value: 'workspace.updated', label: 'workspace.updated' },
    { value: 'user.created', label: 'user.created' },
    { value: 'user.deleted', label: 'user.deleted' },
    { value: 'user.login', label: 'user.login' },
    { value: 'user.logout', label: 'user.logout' },
    { value: 'user.role_changed', label: 'user.role_changed' },
    { value: 'space.created', label: 'space.created' },
    { value: 'space.updated', label: 'space.updated' },
    { value: 'space.deleted', label: 'space.deleted' },
    { value: 'page.created', label: 'page.created' },
    { value: 'page.trashed', label: 'page.trashed' },
    { value: 'page.deleted', label: 'page.deleted' },
    { value: 'page.restored', label: 'page.restored' },
    { value: 'api_key.created', label: 'api_key.created' },
    { value: 'api_key.deleted', label: 'api_key.deleted' },
  ];

  const resourceTypeOptions = [
    { value: '', label: t('All resources') },
    { value: 'workspace', label: 'workspace' },
    { value: 'user', label: 'user' },
    { value: 'page', label: 'page' },
    { value: 'space', label: 'space' },
    { value: 'group', label: 'group' },
    { value: 'comment', label: 'comment' },
    { value: 'share', label: 'share' },
    { value: 'api_key', label: 'api_key' },
    { value: 'sso_provider', label: 'sso_provider' },
  ];

  const rows = (data?.items ?? []).map((entry) => {
    const isExpanded = expandedRows.has(entry.id);
    const hasDetails = !!(entry.changes || entry.metadata);

    return [
      <Table.Tr key={entry.id}>
        <Table.Td>
          <ActionIcon
            variant="subtle"
            size="sm"
            disabled={!hasDetails}
            onClick={() => hasDetails && toggleRow(entry.id)}
          >
            {isExpanded ? (
              <IconChevronDown size={14} />
            ) : (
              <IconChevronRight size={14} />
            )}
          </ActionIcon>
        </Table.Td>
        <Table.Td>
          <Text size="xs" c="dimmed">
            {format(new Date(entry.createdAt), 'PP HH:mm:ss')}
          </Text>
        </Table.Td>
        <Table.Td>
          <Badge variant="light" color={getEventColor(entry.event)} size="sm">
            {entry.event}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Badge variant="outline" size="sm" color="gray">
            {entry.resourceType}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c="dimmed">
            {entry.actorType}
          </Text>
        </Table.Td>
        <Table.Td>
          <Tooltip label={entry.actorId ?? '-'}>
            <Text size="xs" style={{ fontFamily: 'monospace' }} truncate maw={120}>
              {entry.actorId ? `${entry.actorId.slice(0, 8)}…` : '-'}
            </Text>
          </Tooltip>
        </Table.Td>
        <Table.Td>
          <Text size="xs" c="dimmed">
            {entry.ipAddress ?? '-'}
          </Text>
        </Table.Td>
      </Table.Tr>,
      isExpanded && hasDetails ? (
        <Table.Tr key={`${entry.id}-details`}>
          <Table.Td colSpan={7} p={0}>
            <Box bg="gray.0" p="sm">
              {entry.changes && (
                <Stack gap={4} mb="xs">
                  <Text size="xs" fw={600}>
                    {t('Changes')}
                  </Text>
                  <Code block style={{ fontSize: 11 }}>
                    {JSON.stringify(entry.changes, null, 2)}
                  </Code>
                </Stack>
              )}
              {entry.metadata && (
                <Stack gap={4}>
                  <Text size="xs" fw={600}>
                    {t('Metadata')}
                  </Text>
                  <Code block style={{ fontSize: 11 }}>
                    {JSON.stringify(entry.metadata, null, 2)}
                  </Code>
                </Stack>
              )}
            </Box>
          </Table.Td>
        </Table.Tr>
      ) : null,
    ];
  });

  return (
    <>
      <Helmet>
        <title>
          {t('Audits')} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t('Audits')} />

      <Stack gap="md" mb="lg">
        <Group gap="sm" wrap="wrap">
          <Select
            placeholder={t('Filter by event')}
            data={eventOptions}
            value={event ?? ''}
            onChange={(v) => {
              setEvent(v || null);
              setPage(1);
            }}
            clearable
            w={220}
            size="sm"
          />
          <Select
            placeholder={t('Filter by resource')}
            data={resourceTypeOptions}
            value={resourceType ?? ''}
            onChange={(v) => {
              setResourceType(v || null);
              setPage(1);
            }}
            clearable
            w={200}
            size="sm"
          />
          <TextInput
            placeholder={t('Actor ID')}
            value={actorId}
            onChange={(e) => {
              setActorId(e.currentTarget.value);
              setPage(1);
            }}
            leftSection={<IconSearch size={14} />}
            w={200}
            size="sm"
          />
          <DatePickerInput
            placeholder={t('Start date')}
            value={startDate}
            onChange={(v) => {
              setStartDate(v ? new Date(v) : null);
              setPage(1);
            }}
            clearable
            w={160}
            size="sm"
          />
          <DatePickerInput
            placeholder={t('End date')}
            value={endDate}
            onChange={(v) => {
              setEndDate(v ? new Date(v) : null);
              setPage(1);
            }}
            clearable
            w={160}
            size="sm"
          />
        </Group>
      </Stack>

      <Table striped highlightOnHover withTableBorder withColumnBorders={false}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={32} />
            <Table.Th>{t('Time')}</Table.Th>
            <Table.Th>{t('Event')}</Table.Th>
            <Table.Th>{t('Resource')}</Table.Th>
            <Table.Th>{t('Actor Type')}</Table.Th>
            <Table.Th>{t('Actor ID')}</Table.Th>
            <Table.Th>{t('IP Address')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>

      {!isLoading && (data?.items ?? []).length === 0 && (
        <Text c="dimmed" ta="center" mt="lg">
          {t('No audit events found')}
        </Text>
      )}

      {totalPages > 1 && (
        <Group justify="center" mt="lg">
          <Pagination value={page} onChange={setPage} total={totalPages} />
        </Group>
      )}
    </>
  );
}
