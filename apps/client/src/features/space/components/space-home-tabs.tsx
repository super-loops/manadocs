import { Text, Tabs, Space, Paper } from "@mantine/core";
import { IconClockHour3 } from "@tabler/icons-react";
import RecentChanges from "@/components/common/recent-changes.tsx";
import { useParams } from "react-router-dom";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useTranslation } from "react-i18next";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";

export default function SpaceHomeTabs() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);
  const spaceAbility = useSpaceAbility(space?.membership?.permissions);
  const canEdit = spaceAbility.can(
    SpaceCaslAction.Edit,
    SpaceCaslSubject.Page,
  );

  return (
    <>
      {canEdit && space?.authoringRules && (
        <Paper withBorder p="md" mb="md" radius="sm">
          <Text size="sm" fw={600} mb={4}>
            {t("Authoring rules")}
          </Text>
          <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>
            {space.authoringRules}
          </Text>
        </Paper>
      )}

      <Tabs defaultValue="recent">
        <Tabs.List>
          <Tabs.Tab value="recent" leftSection={<IconClockHour3 size={18} />}>
            <Text size="sm" fw={500}>
              {t("Recently updated")}
            </Text>
          </Tabs.Tab>
        </Tabs.List>

        <Space my="md" />

        <Tabs.Panel value="recent">
          {space?.id && <RecentChanges spaceId={space.id} />}
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
