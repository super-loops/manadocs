import { Container } from "@mantine/core";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import { getAppName } from "@/lib/config.ts";
import ComponentDetailView from "@/features/component/components/component-detail-view.tsx";

export default function SpaceComponentDetail() {
  const { t } = useTranslation();
  const { spaceSlug, componentId } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);
  const ability = useSpaceAbility(space?.membership?.permissions);

  if (!space || !componentId) return <></>;

  return (
    <>
      <Helmet>
        <title>
          {t("Components")} - {space.name} - {getAppName()}
        </title>
      </Helmet>
      <Container size={"1100"} pt="xl" pb="xl">
        <ComponentDetailView
          spaceId={space.id}
          spaceSlug={space.slug}
          componentId={componentId}
          canManage={ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page)}
        />
      </Container>
    </>
  );
}
