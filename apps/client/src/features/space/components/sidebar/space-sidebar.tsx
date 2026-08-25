import {
  ActionIcon,
  Collapse,
  Group,
  Menu,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowDown,
  IconDots,
  IconFileExport,
  IconFolders,
  IconHome,
  IconPlus,
  IconSearch,
  IconSettings,
  IconStethoscope,
  IconTrash,
  IconUsers,
  type TablerIcon,
} from "@tabler/icons-react";
import classes from "./space-sidebar.module.css";
import React from "react";
import { useAtom } from "jotai";
import { treeApiAtom } from "@/features/page/tree/atoms/tree-api-atom.ts";
import { Link, useLocation, useParams } from "react-router-dom";
import clsx from "clsx";
import { useDisclosure } from "@mantine/hooks";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { getSpaceUrl } from "@/lib/config.ts";
import SpaceTree from "@/features/page/tree/components/space-tree.tsx";
import WorkingChangesSection from "@/features/working-changes/components/working-changes-section";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import PageImportModal from "@/features/page/components/page-import-modal.tsx";
import { useTranslation } from "react-i18next";
import { SwitchSpace } from "./switch-space";
import ExportModal from "@/components/common/export-modal";
import { mobileSidebarAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import { searchSpotlight } from "@/features/search/constants";
import {
  getSpaceAssetsUrl,
  getSpaceSettingsUrl,
} from "@/features/space/space.utils.ts";

interface SubMenuItem {
  label: string;
  to: string;
  icon: TablerIcon;
  /** 정확히 이 경로일 때만 활성 (부모 경로가 자식까지 먹지 않게) */
  exact?: boolean;
}

interface NavGroupProps {
  label: string;
  icon: TablerIcon;
  to: string;
  items: SubMenuItem[];
  onNavigate?: () => void;
}

/**
 * 하위메뉴를 가진 사이드바 메뉴. 포커스/호버 시 펼치고,
 * 현재 경로가 이 그룹 안이면 계속 펼쳐 둔다.
 */
function NavGroup({ label, icon: Icon, to, items, onNavigate }: NavGroupProps) {
  const location = useLocation();
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  const path = location.pathname.toLowerCase();
  const isInside = items.some((item) =>
    item.exact ? path === item.to.toLowerCase() : path.startsWith(item.to.toLowerCase()),
  );
  const expanded = hovered || focused || isInside;

  const isActive = (item: SubMenuItem) =>
    item.exact ? path === item.to.toLowerCase() : path.startsWith(item.to.toLowerCase());

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setFocused(false);
        }
      }}
    >
      {/* 부모는 배경 강조를 하지 않는다 — 펼쳐진 하위메뉴의 활성 항목이 위치를 말해주고,
          둘 다 칠하면 어디에 있는지 오히려 흐려진다. 현재 섹션은 글자 굵기로만 표시. */}
      <UnstyledButton
        component={Link}
        to={to}
        onClick={onNavigate}
        className={clsx(classes.menu, isInside ? classes.menuCurrent : "")}
      >
        <div className={classes.menuItemInner}>
          <Icon size={18} className={classes.menuItemIcon} stroke={2} />
          <span>{label}</span>
        </div>
      </UnstyledButton>

      <Collapse in={expanded}>
        <div className={classes.subMenu}>
          {items.map((item) => (
            <UnstyledButton
              key={item.to}
              component={Link}
              to={item.to}
              onClick={onNavigate}
              className={clsx(
                classes.subMenuItem,
                isActive(item) ? classes.subMenuItemActive : "",
              )}
            >
              <item.icon size={15} className={classes.subMenuIcon} stroke={2} />
              <span>{item.label}</span>
            </UnstyledButton>
          ))}
        </div>
      </Collapse>
    </div>
  );
}

export function SpaceSidebar() {
  const { t } = useTranslation();
  const [tree] = useAtom(treeApiAtom);
  const [mobileSidebarOpened] = useAtom(mobileSidebarAtom);
  const toggleMobileSidebar = useToggleSidebar(mobileSidebarAtom);

  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);

  const spaceRules = space?.membership?.permissions;
  const spaceAbility = useSpaceAbility(spaceRules);

  if (!space) {
    return <></>;
  }

  function handleCreatePage() {
    tree?.create({ parentId: null, type: "internal", index: 0 });
  }

  const closeMobileSidebar = () => {
    if (mobileSidebarOpened) {
      toggleMobileSidebar();
    }
  };

  const canManagePages = spaceAbility.can(
    SpaceCaslAction.Manage,
    SpaceCaslSubject.Page,
  );

  const settingsItems: SubMenuItem[] = [
    {
      label: t("Settings"),
      to: getSpaceSettingsUrl(spaceSlug),
      icon: IconSettings,
      exact: true,
    },
    {
      label: t("Members"),
      to: getSpaceSettingsUrl(spaceSlug, "members"),
      icon: IconUsers,
    },
  ];

  if (canManagePages) {
    settingsItems.push({
      label: t("점검"),
      to: getSpaceSettingsUrl(spaceSlug, "maintenance"),
      icon: IconStethoscope,
    });
  }

  return (
    <>
      <div className={classes.navbar}>
        <div
          className={classes.section}
          style={{
            border: "none",
            marginTop: 2,
            marginBottom: 3,
          }}
        >
          <SwitchSpace
            spaceName={space?.name}
            spaceSlug={space?.slug}
            spaceIcon={space?.logo}
          />
        </div>

        <div className={classes.section}>
          <div className={classes.menuItems}>
            <NavGroup
              label={t("Overview")}
              icon={IconHome}
              to={getSpaceUrl(spaceSlug)}
              onNavigate={closeMobileSidebar}
              items={[
                {
                  label: t("Recently updated"),
                  to: getSpaceUrl(spaceSlug),
                  icon: IconHome,
                  exact: true,
                },
                {
                  label: t("에셋 브라우저"),
                  to: getSpaceAssetsUrl(spaceSlug),
                  icon: IconFolders,
                },
              ]}
            />

            <NavGroup
              label={t("Space settings")}
              icon={IconSettings}
              to={getSpaceSettingsUrl(spaceSlug)}
              onNavigate={closeMobileSidebar}
              items={settingsItems}
            />

            <UnstyledButton
              className={classes.menu}
              onClick={searchSpotlight.open}
            >
              <div className={classes.menuItemInner}>
                <IconSearch
                  size={18}
                  className={classes.menuItemIcon}
                  stroke={2}
                />
                <span>{t("Search")}</span>
              </div>
            </UnstyledButton>

            {canManagePages && (
              <UnstyledButton
                className={classes.menu}
                onClick={() => {
                  handleCreatePage();
                  closeMobileSidebar();
                }}
              >
                <div className={classes.menuItemInner}>
                  <IconPlus
                    size={18}
                    className={classes.menuItemIcon}
                    stroke={2}
                  />
                  <span>{t("New page")}</span>
                </div>
              </UnstyledButton>
            )}
          </div>
        </div>

        <WorkingChangesSection spaceId={space.id} spaceSlug={space.slug} />

        <div className={clsx(classes.section, classes.sectionPages)}>
          <Group className={classes.pagesHeader} justify="space-between">
            <Text size="xs" fw={500} c="dimmed">
              {t("Pages")}
            </Text>

            {canManagePages && (
              <Group gap="xs">
                <SpaceMenu spaceId={space.id} />

                <Tooltip label={t("Create page")} withArrow position="right">
                  <ActionIcon
                    variant="default"
                    size={18}
                    onClick={handleCreatePage}
                    aria-label={t("Create page")}
                  >
                    <IconPlus />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </Group>

          <div className={classes.pages}>
            <SpaceTree
              spaceId={space.id}
              readOnly={spaceAbility.cannot(
                SpaceCaslAction.Manage,
                SpaceCaslSubject.Page,
              )}
            />
          </div>
        </div>
      </div>
    </>
  );
}

interface SpaceMenuProps {
  spaceId: string;
}
function SpaceMenu({ spaceId }: SpaceMenuProps) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const [importOpened, { open: openImportModal, close: closeImportModal }] =
    useDisclosure(false);
  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);

  return (
    <>
      <Menu width={200} shadow="md" withArrow>
        <Menu.Target>
          <Tooltip
            label={t("Import pages & space settings")}
            withArrow
            position="top"
          >
            <ActionIcon
              variant="default"
              size={18}
              aria-label={t("Space menu")}
            >
              <IconDots />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            onClick={openImportModal}
            leftSection={<IconArrowDown size={16} />}
          >
            {t("Import pages")}
          </Menu.Item>

          <Menu.Item
            onClick={openExportModal}
            leftSection={<IconFileExport size={16} />}
          >
            {t("Export space")}
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item
            component={Link}
            to={getSpaceSettingsUrl(spaceSlug)}
            leftSection={<IconSettings size={16} />}
          >
            {t("Space settings")}
          </Menu.Item>

          <Menu.Item
            component={Link}
            to={`/s/${spaceSlug}/trash`}
            leftSection={<IconTrash size={16} />}
          >
            {t("Trash")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <PageImportModal
        spaceId={spaceId}
        open={importOpened}
        onClose={closeImportModal}
      />

      <ExportModal
        type="space"
        id={spaceId}
        open={exportOpened}
        onClose={closeExportModal}
      />
    </>
  );
}
