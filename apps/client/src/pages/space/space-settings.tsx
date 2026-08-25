import { Container, Group, Text, Title } from "@mantine/core";
import { Navigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { getAppName } from "@/lib/config.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import SpaceDetails from "@/features/space/components/space-details.tsx";
import SpaceSecuritySettings from "@/features/space/components/space-security-settings.tsx";
import SpaceMembersList from "@/features/space/components/space-members.tsx";
import AddSpaceMembersModal from "@/features/space/components/add-space-members-modal.tsx";
import SpaceMaintenance from "@/features/space/components/maintenance/space-maintenance.tsx";
import { getSpaceUrl } from "@/lib/config.ts";

export type SpaceSettingsTab = "general" | "members" | "maintenance";

interface Props {
  tab: SpaceSettingsTab;
}

/**
 * 모달이던 Space 설정을 페이지로 옮긴 것. 탭 전환은 사이드바 하위메뉴가
 * 담당하므로 여기서는 탭 하나만 그린다.
 */
export default function SpaceSettings({ tab }: Props) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const { data: space, isLoading } = useGetSpaceBySlugQuery(spaceSlug);

  const spaceAbility = useSpaceAbility(space?.membership?.permissions);

  if (isLoading || !space) {
    return <></>;
  }

  const canManageSettings = spaceAbility.can(
    SpaceCaslAction.Manage,
    SpaceCaslSubject.Settings,
  );
  const canManagePages = spaceAbility.can(
    SpaceCaslAction.Manage,
    SpaceCaslSubject.Page,
  );

  // 점검은 정리 액션이 따라붙으므로 권한 없으면 설정 탭으로 돌려보낸다
  if (tab === "maintenance" && !canManagePages) {
    return <Navigate to={`${getSpaceUrl(spaceSlug)}/settings`} replace />;
  }

  const titles: Record<SpaceSettingsTab, string> = {
    general: t("Settings"),
    members: t("Members"),
    maintenance: t("점검"),
  };

  return (
    <>
      <Helmet>
        <title>
          {titles[tab]} - {space.name} - {getAppName()}
        </title>
      </Helmet>
      <Container size={"800"} pt="xl" pb="xl">
        <Group justify="space-between" align="flex-end" mb="md">
          <div>
            <Text size="xs" c="dimmed">
              {space.name}
            </Text>
            <Title order={3}>{titles[tab]}</Title>
          </div>

          {tab === "members" &&
            spaceAbility.can(
              SpaceCaslAction.Manage,
              SpaceCaslSubject.Member,
            ) && <AddSpaceMembersModal spaceId={space.id} />}
        </Group>

        {tab === "general" && (
          <>
            <SpaceDetails spaceId={space.id} readOnly={!canManageSettings} />
            {canManageSettings && (
              <SpaceSecuritySettings space={space} readOnly={false} />
            )}
          </>
        )}

        {tab === "members" && (
          <SpaceMembersList
            spaceId={space.id}
            readOnly={spaceAbility.cannot(
              SpaceCaslAction.Manage,
              SpaceCaslSubject.Member,
            )}
          />
        )}

        {tab === "maintenance" && (
          <SpaceMaintenance spaceId={space.id} spaceSlug={space.slug} />
        )}
      </Container>
    </>
  );
}
