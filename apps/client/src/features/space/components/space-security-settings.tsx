import { Text, Divider } from "@mantine/core";
import React from "react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import {
  SPACE_SECURITY_TOGGLES_ENABLED,
  SpacePublicSharingToggle,
  SpaceViewerCommentsToggle,
} from "@/ee/share/components/space-security-toggles.tsx";

type SpaceSecuritySettingsProps = {
  space: ISpace;
  readOnly?: boolean;
};

export default function SpaceSecuritySettings({
  space,
  readOnly,
}: SpaceSecuritySettingsProps) {
  const { t } = useTranslation();

  if (readOnly) return null;

  // 토글이 전부 stub 이면 제목+구분선만 남아 깨진 화면으로 보인다 — 섹션째 숨긴다
  if (!SPACE_SECURITY_TOGGLES_ENABLED) return null;

  return (
    <div>
      <Text my="md" fw={600}>
        {t("Security")}
      </Text>

      <SpacePublicSharingToggle space={space} />

      <Divider my="lg" />

      <SpaceViewerCommentsToggle space={space} />
    </div>
  );
}
