import { useAtomValue } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { findBreadcrumbPath } from "@/features/page/tree/utils";
import {
  Button,
  Anchor,
  Popover,
  Breadcrumbs,
  ActionIcon,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconCornerDownRightDouble, IconDots } from "@tabler/icons-react";
import { Link, useParams } from "react-router-dom";
import classes from "./breadcrumb.module.css";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { extractPageSlugId } from "@/lib";
import { useMediaQuery } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { formatVersionSummary, getBranchCode } from "@/lib/branch-code.ts";
import { usePageVersionBadgeMap } from "@/features/space/queries/space-insight-query.ts";

function getTitle(name: string, icon: string) {
  // 이모지 1급 — 미지정 시 기본 문서 이모지(📄)
  return `${icon || "📄"} ${name}`;
}

export default function Breadcrumb() {
  const { t } = useTranslation();
  const treeData = useAtomValue(treeDataAtom);
  /** 빈 제목 표기는 앱 전체에서 "제목 없음"(untitled) 하나로 통일 */
  // renderAnchor 의 deps 에 넣어야 하는데 매 렌더 새로 만들어지면 메모가 무의미해진다.
  // t 에만 의존하므로 고정해 둔다 — renderAnchor 는 이미 t 에 의존해 빈도는 그대로다.
  const nameOf = useCallback((name: string) => name || t("untitled"), [t]);
  const [breadcrumbNodes, setBreadcrumbNodes] = useState<
    SpaceTreeNode[] | null
  >(null);
  const { pageSlug, spaceSlug } = useParams();
  const { data: currentPage } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const isMobile = useMediaQuery("(max-width: 48em)");

  /**
   * 지금 보고 있는 문서(브레드크럼 마지막 항목)의 버전·작업문서 요약.
   * 트리 hover 툴팁과 **같은 함수**를 써서 문구가 갈라지지 않게 한다.
   * 조상 경로 항목은 제목만 그대로 둔다(유저 결정) — 시간 2줄도 네비게이션
   * 영역(트리) 전용이라 여기엔 넣지 않는다.
   */
  const versionBadges = usePageVersionBadgeMap(currentPage?.spaceId ?? "");
  const currentPageId = currentPage?.id;
  const currentVersionSummary = useMemo(() => {
    const badge = currentPageId ? versionBadges.get(currentPageId) : null;
    return badge
      ? formatVersionSummary(t, {
          version: badge.version,
          branchCode: getBranchCode(badge.workingDocId),
          baseVersion: badge.baseVersion,
        })
      : null;
  }, [currentPageId, versionBadges, t]);

  useEffect(() => {
    if (treeData?.length > 0 && currentPage) {
      const breadcrumb = findBreadcrumbPath(treeData, currentPage.id);
      // 조건이 안 맞으면 «세팅하지 않아» 직전 값을 유지하는 것이 의도된 동작이다.
      // useMemo 파생으로 바꾸면 페이지 이동 중 currentPage 가 잠시 비는 순간
      // 상단 문서명이 사라졌다 돌아온다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBreadcrumbNodes(breadcrumb || null);
    }
  }, [currentPage?.id, treeData]);

  const HiddenNodesTooltipContent = () =>
    breadcrumbNodes?.slice(1, -1).map((node) => (
      <Button.Group orientation="vertical" key={node.id}>
        <Button
          justify="start"
          component={Link}
          to={buildPageUrl(spaceSlug, node.slugId, node.name)}
          variant="default"
          style={{ border: "none" }}
        >
          <Text fz={"sm"} className={classes.truncatedText}>
            {getTitle(nameOf(node.name), node.icon)}
          </Text>
        </Button>
      </Button.Group>
    ));

  const MobileHiddenNodesTooltipContent = () =>
    breadcrumbNodes?.map((node) => (
      <Button.Group orientation="vertical" key={node.id}>
        <Button
          justify="start"
          component={Link}
          to={buildPageUrl(spaceSlug, node.slugId, node.name)}
          variant="default"
          style={{ border: "none" }}
        >
          <Text fz={"sm"} className={classes.truncatedText}>
            {getTitle(nameOf(node.name), node.icon)}
          </Text>
        </Button>
      </Button.Group>
    ));

  const renderAnchor = useCallback(
    (node: SpaceTreeNode, versionSummary?: string | null) => (
      <Tooltip
        label={
          versionSummary ? (
            <Stack gap={2}>
              <Text size="sm">{nameOf(node.name)}</Text>
              <Text size="xs">{versionSummary}</Text>
            </Stack>
          ) : (
            nameOf(node.name)
          )
        }
        multiline={!!versionSummary}
        key={node.id}
      >
        <Anchor
          component={Link}
          to={buildPageUrl(spaceSlug, node.slugId, node.name)}
          underline="never"
          fz="sm"
          key={node.id}
          className={classes.truncatedText}
        >
          {getTitle(nameOf(node.name), node.icon)}
        </Anchor>
      </Tooltip>
    ),
    [spaceSlug, nameOf],
  );

  /** 마지막 항목 = 지금 보고 있는 문서. 여기에만 버전·작업문서를 붙인다. */
  const renderCurrentAnchor = (node: SpaceTreeNode) =>
    renderAnchor(node, currentVersionSummary);

  const getBreadcrumbItems = () => {
    if (!breadcrumbNodes) return [];

    if (breadcrumbNodes.length > 3) {
      const firstNode = breadcrumbNodes[0];
      //const secondLastNode = breadcrumbNodes[breadcrumbNodes.length - 2];
      const lastNode = breadcrumbNodes[breadcrumbNodes.length - 1];

      return [
        renderAnchor(firstNode),
        <Popover
          width={250}
          position="bottom"
          withArrow
          shadow="xl"
          key="hidden-nodes"
        >
          <Popover.Target>
            <ActionIcon color="gray" variant="transparent">
              <IconDots size={20} stroke={2} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <HiddenNodesTooltipContent />
          </Popover.Dropdown>
        </Popover>,
        //renderAnchor(secondLastNode),
        renderCurrentAnchor(lastNode),
      ];
    }

    return breadcrumbNodes.map((node, index) =>
      index === breadcrumbNodes.length - 1
        ? renderCurrentAnchor(node)
        : renderAnchor(node),
    );
  };

  const getMobileBreadcrumbItems = () => {
    if (!breadcrumbNodes) return [];

    if (breadcrumbNodes.length > 0) {
      return [
        <Popover
          width={250}
          position="bottom"
          withArrow
          shadow="xl"
          key="mobile-hidden-nodes"
        >
          <Popover.Target>
            <Tooltip label="Breadcrumbs">
              <ActionIcon color="gray" variant="transparent">
                <IconCornerDownRightDouble size={20} stroke={2} />
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          <Popover.Dropdown>
            <MobileHiddenNodesTooltipContent />
          </Popover.Dropdown>
        </Popover>,
      ];
    }

    return breadcrumbNodes.map((node, index) =>
      index === breadcrumbNodes.length - 1
        ? renderCurrentAnchor(node)
        : renderAnchor(node),
    );
  };

  return (
    <div className={classes.breadcrumbDiv}>
      {breadcrumbNodes && (
        <Breadcrumbs className={classes.breadcrumbs}>
          {isMobile ? getMobileBreadcrumbItems() : getBreadcrumbItems()}
        </Breadcrumbs>
      )}
    </div>
  );
}
