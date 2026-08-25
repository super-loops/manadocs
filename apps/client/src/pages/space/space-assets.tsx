import { Container, Title } from "@mantine/core";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { getAppName } from "@/lib/config.ts";
import AssetBrowser from "@/features/space/components/assets/asset-browser.tsx";

export default function SpaceAssets() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);

  if (!space) {
    return <></>;
  }

  return (
    <>
      <Helmet>
        <title>
          {t("에셋 브라우저")} - {space.name} - {getAppName()}
        </title>
      </Helmet>
      <Container size={"1000"} pt="xl">
        <Title order={3} mb="md">
          {t("에셋 브라우저")}
        </Title>
        <AssetBrowser spaceId={space.id} spaceSlug={space.slug} />
      </Container>
    </>
  );
}
