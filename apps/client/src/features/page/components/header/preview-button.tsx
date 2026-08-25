import { ActionIcon, Tooltip } from "@mantine/core";
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

  // 설명("독자가 보는 화면")은 모달 안으로 옮겼다 — 헤더는 아이콘만.
  return (
    <Tooltip label={t("미리보기")} openDelay={250} withArrow>
      <ActionIcon
        variant="subtle"
        color="dark"
        aria-label={t("미리보기")}
        onClick={() => setPreviewVersionId(page.primaryVersionId)}
      >
        <IconEye size={20} stroke={1.7} />
      </ActionIcon>
    </Tooltip>
  );
}
