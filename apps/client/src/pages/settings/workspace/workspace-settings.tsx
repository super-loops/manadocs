import SettingsTitle from "@/components/settings/settings-title.tsx";
import WorkspaceNameForm from "@/features/workspace/components/settings/components/workspace-name-form";
import WorkspaceIcon from "@/features/workspace/components/settings/components/workspace-icon.tsx";
import WorkspaceMcpInstructionsForm from "@/features/workspace/components/settings/components/workspace-mcp-instructions-form";
import WorkspaceMcpPreview from "@/features/workspace/components/settings/components/workspace-mcp-preview";
import { useTranslation } from "react-i18next";
import { getAppName, isCloud } from "@/lib/config.ts";
import { Helmet } from "react-helmet-async";
import { Divider } from "@mantine/core";
import { ManageHostname } from "@/ee/workspace/components/manage-hostname.tsx";
import useUserRole from "@/hooks/use-user-role.tsx";

export default function WorkspaceSettings() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  return (
    <>
      <Helmet>
        <title>Workspace Settings - {getAppName()}</title>
      </Helmet>
      <SettingsTitle title={t("General")} />
      <WorkspaceIcon />
      <WorkspaceNameForm />

      {isCloud() && (
        <>
          <Divider my="md" />
          <ManageHostname />
        </>
      )}

      {isAdmin && (
        <>
          <Divider my="md" />
          <SettingsTitle title={t("MCP")} />
          <WorkspaceMcpInstructionsForm />
          <WorkspaceMcpPreview />
        </>
      )}
    </>
  );
}
