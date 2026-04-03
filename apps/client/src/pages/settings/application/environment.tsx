import {
  Badge,
  Code,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useMemo, useState } from "react";
import { getAppName } from "@/lib/config.ts";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import api from "@/lib/api-client";

type EnvCategory =
  | "general"
  | "database"
  | "storage"
  | "mail"
  | "collab"
  | "search"
  | "ai"
  | "events"
  | "billing"
  | "telemetry";

interface EnvRuntimeEntry {
  key: string;
  category: EnvCategory;
  description: string;
  defaultValue?: string;
  secret?: boolean;
  enum?: string[];
  setByEnv: boolean;
  hasValue: boolean;
  value: string | null;
}

const CATEGORY_ORDER: EnvCategory[] = [
  "general",
  "database",
  "storage",
  "mail",
  "collab",
  "search",
  "ai",
  "events",
  "billing",
  "telemetry",
];

export default function EnvironmentPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-environment"],
    queryFn: async () => {
      const res = (await api.post("/admin/environment")) as unknown as {
        entries: EnvRuntimeEntry[];
      };
      return res;
    },
  });

  const grouped = useMemo(() => {
    const entries = data?.entries ?? [];
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? entries.filter(
          (e) =>
            e.key.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q),
        )
      : entries;
    const byCat = new Map<EnvCategory, EnvRuntimeEntry[]>();
    for (const entry of filtered) {
      if (!byCat.has(entry.category)) byCat.set(entry.category, []);
      byCat.get(entry.category)!.push(entry);
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
      category: c,
      items: byCat.get(c)!,
    }));
  }, [data, filter]);

  const renderValue = (entry: EnvRuntimeEntry) => {
    if (entry.secret) {
      if (!entry.hasValue) {
        return (
          <Text size="xs" c="dimmed">
            {t("(not set)")}
          </Text>
        );
      }
      return (
        <Code style={{ fontSize: 12 }}>***</Code>
      );
    }
    if (entry.value === null || entry.value === "") {
      return (
        <Text size="xs" c="dimmed">
          {t("(not set)")}
        </Text>
      );
    }
    return <Code style={{ fontSize: 12 }}>{entry.value}</Code>;
  };

  return (
    <>
      <Helmet>
        <title>
          {t("Environment")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("Environment")} />

      <Text size="sm" c="dimmed" mb="md">
        {t(
          "Application settings controlled by environment variables. Secret values are masked.",
        )}
      </Text>

      <Stack gap="md" mb="md">
        <Group gap="sm">
          <TextInput
            placeholder={t("Filter by key or description")}
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
            leftSection={<IconSearch size={14} />}
            w={320}
            size="sm"
          />
        </Group>
      </Stack>

      {isLoading && (
        <Text c="dimmed" size="sm">
          {t("Loading...")}
        </Text>
      )}

      {grouped.map((group) => (
        <div key={group.category} style={{ marginBottom: 24 }}>
          <Text fw={600} size="sm" tt="uppercase" c="dimmed" mb={6}>
            {t(group.category)}
          </Text>
          <Table striped withTableBorder withColumnBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={280}>{t("Option")}</Table.Th>
                <Table.Th>{t("Value")}</Table.Th>
                <Table.Th w={120}>{t("Source")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {group.items.map((entry) => (
                <Table.Tr key={entry.key}>
                  <Table.Td>
                    <Stack gap={2}>
                      <Code style={{ fontSize: 12, fontWeight: 600 }}>
                        {entry.key}
                      </Code>
                      <Text size="xs" c="dimmed">
                        {entry.description}
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>{renderValue(entry)}</Table.Td>
                  <Table.Td>
                    {entry.setByEnv ? (
                      <Badge variant="light" color="blue" size="sm">
                        ENV
                      </Badge>
                    ) : entry.defaultValue !== undefined ? (
                      <Badge variant="light" color="gray" size="sm">
                        {t("Default")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" color="gray" size="sm">
                        {t("Unset")}
                      </Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      ))}

      {!isLoading && grouped.length === 0 && (
        <Text c="dimmed" ta="center" mt="lg">
          {t("No matching environment variables")}
        </Text>
      )}
    </>
  );
}
