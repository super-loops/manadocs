import WorkspaceInviteModal from "@/features/workspace/components/members/components/workspace-invite-modal";
import { Group, SegmentedControl, Space, Text } from "@mantine/core";
import WorkspaceMembersTable from "@/features/workspace/components/members/components/workspace-members-table";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { useNavigate, useSearchParams } from "react-router-dom";
import WorkspaceInvitesTable from "@/features/workspace/components/members/components/workspace-invites-table.tsx";
import useUserRole from "@/hooks/use-user-role.tsx";
import { getAppName } from "@/lib/config.ts";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";

export default function WorkspaceMembers() {
  const { t } = useTranslation();
  const [workspace] = useAtom(workspaceAtom);
  const [searchParams] = useSearchParams();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  // 탭은 URL 이 진실이다 — state 로 복사하면 뒤로가기 때 URL 과 화면이 어긋난다.
  const segmentValue =
    searchParams.get("tab") === "invites" ? "invites" : "members";

  const handleSegmentChange = (value: string) => {
    if (value === "invites") {
      navigate(`?tab=${value}`);
    } else {
      navigate("");
    }
  };

  return (
    <>
      <Helmet>
        <title>
          {t("Members")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("Members")} />

      {/* <WorkspaceInviteSection /> */}
      {/* <Divider my="lg" /> */}

      <Group justify="space-between">
        <SegmentedControl
          value={segmentValue}
          onChange={handleSegmentChange}
          data={[
            {
              label: t("Members") + ` (${workspace?.memberCount})`,
              value: "members",
            },
            { label: t("Pending"), value: "invites" },
          ]}
          withItemsBorders={false}
        />

        {isAdmin && <WorkspaceInviteModal />}
      </Group>

      <Space h="lg" />

      {segmentValue === "invites" ? (
        <WorkspaceInvitesTable />
      ) : (
        <WorkspaceMembersTable />
      )}
    </>
  );
}
