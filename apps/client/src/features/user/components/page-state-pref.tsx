import { Text, MantineSize, SegmentedControl } from "@mantine/core";
import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateUser } from "@/features/user/services/user-service.ts";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { ResponsiveSettingsRow, ResponsiveSettingsContent, ResponsiveSettingsControl } from "@/components/ui/responsive-settings-row";

export default function PageStatePref() {
  const { t } = useTranslation();

  return (
    <ResponsiveSettingsRow>
      <ResponsiveSettingsContent>
        <Text size="md">{t("Default page edit mode")}</Text>
        <Text size="sm" c="dimmed">
          {t("Choose your preferred page edit mode. Avoid accidental edits.")}
        </Text>
      </ResponsiveSettingsContent>

      <ResponsiveSettingsControl>
        <PageStateSegmentedControl />
      </ResponsiveSettingsControl>
    </ResponsiveSettingsRow>
  );
}

interface PageStateSegmentedControlProps {
  size?: MantineSize;
}

export function PageStateSegmentedControl({
  size,
}: PageStateSegmentedControlProps) {
  const { t } = useTranslation();
  const [user, setUser] = useAtom(userAtom);
  const pageEditMode =
    user?.settings?.preferences?.pageEditMode ?? PageEditMode.Edit;
  // atom 값을 state 로 복사하지 않는다 — 저장이 끝나기 전까지만 쓰는 낙관적
  // 값을 따로 들고, 없으면 atom 을 그대로 읽는다. 실패하면 override 를 버려
  // atom 값(=이전 값)으로 자연히 돌아간다.
  const [optimisticValue, setOptimisticValue] = useState<string | null>(null);
  const value = optimisticValue ?? pageEditMode;

  const handleChange = useCallback(
    async (newValue: string) => {
      setOptimisticValue(newValue);
      try {
        const updatedUser = await updateUser({ pageEditMode: newValue });
        setUser(updatedUser);
      } catch {
        setOptimisticValue(null);
      }
    },
    [setUser],
  );

  return (
    <SegmentedControl
      size={size}
      value={value}
      onChange={handleChange}
      data={[
        { label: t("Edit"), value: PageEditMode.Edit },
        { label: t("Read"), value: PageEditMode.Read },
      ]}
    />
  );
}
