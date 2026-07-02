import { Button, Tooltip } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { previewVersionIdAtom } from "@/features/page-version/atoms/page-version-atoms";

/** 헤더 미리보기 버튼 — 현재 Primary 버전을 reader 시점으로 */
export default function PreviewButton() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const setPreviewVersionId = useSetAtom(previewVersionIdAtom);

  if (!page?.primaryVersionId) return null;

  return (
    <Tooltip label={t("Primary 버전을 reader 시점으로")} openDelay={250} withArrow>
      <Button
        size="compact-sm"
        variant="subtle"
        color="dark"
        leftSection={<IconEye size={16} stroke={1.5} />}
        onClick={() => setPreviewVersionId(page.primaryVersionId)}
      >
        {t("미리보기")}
      </Button>
    </Tooltip>
  );
}
