import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useSharePageQuery } from "@/features/share/queries/share-query.ts";
import { Alert, Container } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import React, { useEffect } from "react";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";
import { extractPageSlugId } from "@/lib";
import { Error404 } from "@/components/ui/error-404.tsx";
import ShareBranding from "@/features/share/components/share-branding.tsx";
import { useAtomValue } from "jotai";
import { sharedTreeDataAtom } from "@/features/share/atoms/shared-page-atom.ts";
import { isPageInTree } from "@/features/share/utils.ts";

export default function SharedPage() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { shareId } = useParams();
  const navigate = useNavigate();

  // shareId(key)를 함께 보내야 링크별 버전 모드(최신 추종/버전 고정)로 서빙된다
  const { data, isLoading, isError, error } = useSharePageQuery({
    pageId: extractPageSlugId(pageSlug),
    shareId,
  });

  const sharedTreeData = useAtomValue(sharedTreeDataAtom);

  useEffect(() => {
    if (shareId && data) {
      if (data.share.key !== shareId) {

        // Check if the current page is part of the active sharing tree (sidebar) - If we are part of it, we will not redirect, keeping the sidebar visible.
        const isPartOfTree =
          sharedTreeData && isPageInTree(sharedTreeData, data.page.slugId);

        if (!isPartOfTree) {
          navigate(`/share/${data.share.key}/p/${pageSlug}`, { replace: true });
        }
      }
    }
  }, [shareId, data, sharedTreeData]);

  if (isLoading) {
    return <></>;
  }

  if (isError || !data) {
    if ([401, 403, 404].includes(error?.["status"])) {
      return <Error404 />;
    }
    return <div>{t("Error fetching page data.")}</div>;
  }

  return (
    <div>
      <Helmet>
        <title>{`${data?.page?.title || t("untitled")}`}</title>
        {!data?.share.searchIndexing && (
          <meta name="robots" content="noindex" />
        )}
      </Helmet>

      <Container size={900} p={0}>
        {data.versionInfo?.fallback && (
          <Alert
            variant="light"
            color="yellow"
            icon={<IconInfoCircle size={16} />}
            mt="md"
          >
            {t(
              "이 링크가 가리키던 버전이 폐기되어 가장 가까운 버전 {{n}}(으)로 안내되었습니다.",
              { n: data.versionInfo.version },
            )}
          </Alert>
        )}
        <ReadonlyPageEditor
          key={`${data.page.id}:${data.versionInfo?.versionId ?? ""}`}
          title={data.page.title}
          content={data.page.content}
          pageId={data.page.id}
        />
      </Container>

      {data && !shareId && !(data.features?.length > 0) && <ShareBranding />}
    </div>
  );
}
