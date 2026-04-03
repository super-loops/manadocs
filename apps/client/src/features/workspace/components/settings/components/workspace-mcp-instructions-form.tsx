import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useAtom } from "jotai";
import { useState } from "react";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { Textarea, Button } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import useUserRole from "@/hooks/use-user-role.tsx";
import { useTranslation } from "react-i18next";

type FormValues = {
  mcpInstructions: string;
};

export default function WorkspaceMcpInstructionsForm() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const { isAdmin } = useUserRole();

  const form = useForm<FormValues>({
    initialValues: {
      mcpInstructions: workspace?.mcpInstructions ?? "",
    },
  });

  async function handleSubmit(data: FormValues) {
    setIsLoading(true);
    try {
      const updated = await updateWorkspace({
        mcpInstructions: data.mcpInstructions,
      });
      setWorkspace(updated);
      notifications.show({ message: t("Updated successfully") });
      form.resetDirty();
    } catch (err) {
      console.log(err);
      notifications.show({
        message: t("Failed to update data"),
        color: "red",
      });
    }
    setIsLoading(false);
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Textarea
        label={t("MCP instructions")}
        description={t(
          "Additional guidance appended to the system prompt sent to MCP clients.",
        )}
        placeholder={t("e.g. Respond in Korean. Prefer concise answers.")}
        variant="filled"
        minRows={5}
        autosize
        maxLength={10000}
        readOnly={!isAdmin}
        {...form.getInputProps("mcpInstructions")}
      />

      {isAdmin && (
        <Button
          mt="sm"
          type="submit"
          disabled={isLoading || !form.isDirty()}
          loading={isLoading}
        >
          {t("Save")}
        </Button>
      )}
    </form>
  );
}
