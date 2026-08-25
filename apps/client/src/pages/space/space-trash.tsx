import Trash from "@/features/page/trash/components/trash.tsx";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { getAppName } from "@/lib/config.ts";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import React from "react";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";

export default function SpaceTrash() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);

  const spaceRules = space?.membership?.permissions;
  const spaceAbility = useSpaceAbility(spaceRules);

  if (!space) {
    return <></>;
  }

  if (spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)) {
    return <></>;
  }

  return (
    <>
      {/* 타이틀이 없으면 직전 화면 제목이 탭에 그대로 남는다 */}
      <Helmet>
        <title>
          {t("Trash")} - {space.name} - {getAppName()}
        </title>
      </Helmet>
      <Trash />
    </>
  );
}
