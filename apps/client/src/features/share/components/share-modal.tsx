import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Indicator,
  Popover,
  Radio,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconLock,
  IconTrash,
  IconWorld,
} from "@tabler/icons-react";
import React, { useEffect, useState } from "react";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useClipboard } from "@/hooks/use-clipboard";
import {
  useCreateShareMutation,
  useDeleteShareMutation,
  useShareForPageQuery,
  useSharesForPageQuery,
} from "@/features/share/queries/share-query.ts";
import { Link, useNavigate, useParams } from "react-router-dom";
import { extractPageSlugId, getPageIcon } from "@/lib";
import { useTranslation } from "react-i18next";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { getAppUrl, isCloud } from "@/lib/config.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import classes from "@/features/share/components/share.module.css";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useSpaceQuery } from "@/features/space/queries/space-query.ts";
import { useTrial } from "@/ee/trial/hooks/use-trial.ts";
import { usePageVersionsQuery } from "@/features/page-version/queries/page-version-query";
import {
  IShare,
  ShareOnDiscard,
  ShareVersionMode,
} from "@/features/share/types/share.types.ts";

interface ShareModalProps {
  readOnly: boolean;
}

/**
 * 공유 모달 — 페이지 단위 다중 링크.
 * "새로 만들기" 탭: 공유타입(최신 Primary 추종 / 특정 버전 고정) + 폐기 시 동작.
 * "공유된 링크" 탭: 발급된 링크 목록(복사·열기·삭제).
 * D2 — 확정 버전이 없으면 링크 발급 불가.
 */
export default function ShareModal({ readOnly }: ShareModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pageSlug, spaceSlug } = useParams();
  const pageSlugId = extractPageSlugId(pageSlug);
  const { data: page } = usePageQuery({ pageId: pageSlugId });
  const pageId = page?.id;
  const canEdit = page?.permissions?.canEdit ?? false;

  const { data: inheritedShare } = useShareForPageQuery(pageId);
  const { data: shares } = useSharesForPageQuery(pageId, canEdit && !readOnly);
  const { isTrial } = useTrial();
  const [workspace] = useAtom(workspaceAtom);
  const { data: space } = useSpaceQuery(spaceSlug);
  const workspaceDisabled = workspace?.settings?.sharing?.disabled === true;
  const spaceDisabled = space?.settings?.sharing?.disabled === true;
  const sharingDisabled = workspaceDisabled || spaceDisabled;

  const shareCount = shares?.length ?? 0;
  // 이 페이지에 직접 발급된 링크가 없고 조상 공유를 상속받는 경우
  const isDescendantShared =
    shareCount === 0 && inheritedShare && inheritedShare.level > 0;

  // 확인 모달은 포털로 렌더돼 팝오버의 "바깥 클릭"으로 오인된다 —
  // 모달이 떠 있는 동안은 팝오버가 닫히지 않게 잠근다.
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Popover
      width={400}
      position="bottom"
      withArrow
      shadow="md"
      closeOnClickOutside={!confirmOpen}
    >
      <Popover.Target>
        <Button
          size="compact-sm"
          leftSection={
            <Indicator
              color="green"
              offset={5}
              disabled={shareCount === 0 && !isDescendantShared}
              withBorder
            >
              <IconWorld size={20} stroke={1.5} />
            </Indicator>
          }
          rightSection={
            shareCount > 0 ? (
              <Badge size="xs" variant="filled" color="blue" circle>
                {shareCount}
              </Badge>
            ) : undefined
          }
          color="dark"
          variant="subtle"
        >
          {t("Share")}
        </Button>
      </Popover.Target>
      <Popover.Dropdown style={{ userSelect: "none" }}>
        {isCloud() && isTrial ? (
          <>
            <Group justify="center" mb="sm">
              <IconLock size={20} stroke={1.5} />
            </Group>
            <Text size="sm" ta="center" fw={500} mb="xs">
              {t("Upgrade to share pages")}
            </Text>
            <Button
              size="xs"
              onClick={() => navigate("/settings/billing")}
              fullWidth
            >
              {t("Upgrade Plan")}
            </Button>
          </>
        ) : sharingDisabled ? (
          <>
            <Group justify="center" mb="sm">
              <IconLock size={20} stroke={1.5} />
            </Group>
            <Text size="sm" ta="center" fw={500} mb="xs">
              {t("Public sharing is disabled")}
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              {workspaceDisabled
                ? t("Public sharing has been disabled at the workspace level.")
                : t("Public sharing has been disabled for this space.")}
            </Text>
          </>
        ) : isDescendantShared ? (
          <>
            <Text size="sm">{t("Inherits public sharing from")}</Text>
            <Anchor
              size="sm"
              underline="never"
              style={{ cursor: "pointer", color: "var(--mantine-color-text)" }}
              component={Link}
              to={buildPageUrl(
                spaceSlug,
                inheritedShare.sharedPage.slugId,
                inheritedShare.sharedPage.title,
              )}
            >
              <Group gap="4" wrap="nowrap" my="sm">
                {getPageIcon(inheritedShare.sharedPage.icon)}
                <div className={classes.shareLinkText}>
                  <Text fz="sm" fw={500} lineClamp={1}>
                    {inheritedShare.sharedPage.title || t("untitled")}
                  </Text>
                </div>
              </Group>
            </Anchor>
          </>
        ) : (
          <ShareTabs
            pageId={pageId}
            pageSlug={pageSlug}
            hasCommitted={!!page?.primaryVersionId}
            shares={shares ?? []}
            readOnly={readOnly || !canEdit}
            onConfirmOpenChange={setConfirmOpen}
          />
        )}
      </Popover.Dropdown>
    </Popover>
  );
}

function ShareTabs({
  pageId,
  pageSlug,
  hasCommitted,
  shares,
  readOnly,
  onConfirmOpenChange,
}: {
  pageId: string;
  pageSlug: string;
  hasCommitted: boolean;
  shares: IShare[];
  readOnly: boolean;
  onConfirmOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>(
    shares.length > 0 ? "links" : "create",
  );

  return (
    <Tabs value={activeTab} onChange={(value) => setActiveTab(value ?? "create")}>
      <Tabs.List grow mb="sm">
        <Tabs.Tab value="create" disabled={readOnly}>
          {t("새로 만들기")}
        </Tabs.Tab>
        <Tabs.Tab value="links">
          {t("공유된 링크")} {shares.length > 0 ? `(${shares.length})` : ""}
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="create">
        <CreateShareForm
          pageId={pageId}
          hasCommitted={hasCommitted}
          onCreated={() => setActiveTab("links")}
        />
      </Tabs.Panel>

      <Tabs.Panel value="links">
        <ShareLinkList
          shares={shares}
          pageId={pageId}
          pageSlug={pageSlug}
          readOnly={readOnly}
          onConfirmOpenChange={onConfirmOpenChange}
        />
      </Tabs.Panel>
    </Tabs>
  );
}

function CreateShareForm({
  pageId,
  hasCommitted,
  onCreated,
}: {
  pageId: string;
  hasCommitted: boolean;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [versionMode, setVersionMode] = useState<ShareVersionMode>("primary");
  const [fixedVersionId, setFixedVersionId] = useState<string | null>(null);
  const [onDiscard, setOnDiscard] = useState<ShareOnDiscard>("fallback");
  const [includeSubPages, setIncludeSubPages] = useState(true);
  const createShareMutation = useCreateShareMutation();

  const { data: versionsData } = usePageVersionsQuery(
    versionMode === "fixed" ? pageId : undefined,
  );
  const versionOptions =
    versionsData?.pages
      ?.flatMap((p) => p.items)
      .filter((v) => v.version > 0 && !v.discardedAt)
      .map((v) => ({
        value: v.id,
        label: `${t("버전")} ${v.version}${v.message ? ` — ${v.message}` : ""}`,
      })) ?? [];

  if (!hasCommitted) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        {t(
          "아직 확정된 버전이 없어 공유할 수 없습니다. 먼저 문서확정을 해주세요.",
        )}
      </Text>
    );
  }

  const handleCreate = async () => {
    await createShareMutation.mutateAsync({
      pageId,
      includeSubPages,
      searchIndexing: false,
      versionMode,
      ...(versionMode === "fixed"
        ? { fixedVersionId: fixedVersionId ?? undefined, onDiscard }
        : {}),
    });
    onCreated();
  };

  return (
    <Stack gap="sm">
      <Radio.Group
        label={t("공유타입")}
        value={versionMode}
        onChange={(value) => setVersionMode(value as ShareVersionMode)}
      >
        <Stack gap={6} mt={6}>
          <Radio
            value="primary"
            label={t("최신으로")}
            description={t("Primary 버전이 바뀌면 자동 반영됩니다")}
          />
          <Radio
            value="fixed"
            label={t("현재 버전 고정")}
            description={t("선택한 버전 스냅샷만 보여줍니다")}
          />
        </Stack>
      </Radio.Group>

      {versionMode === "fixed" && (
        <>
          <Select
            label={t("고정할 버전")}
            placeholder={t("기본: 현재 Primary")}
            data={versionOptions}
            value={fixedVersionId}
            onChange={setFixedVersionId}
            clearable
            // Popover 안의 Select — portal 렌더 시 외부 클릭으로 오인돼 팝오버가 닫힘
            comboboxProps={{ withinPortal: false }}
          />
          <Select
            label={t("폐기 시 동작")}
            description={t("고정한 버전이 폐기되면")}
            data={[
              { value: "fallback", label: t("가까운 버전으로 안내 (fallback)") },
              { value: "404", label: t("링크 차단 (404)") },
            ]}
            value={onDiscard}
            onChange={(value) =>
              setOnDiscard((value as ShareOnDiscard) ?? "fallback")
            }
            allowDeselect={false}
            comboboxProps={{ withinPortal: false }}
          />
        </>
      )}

      <Switch
        label={t("Include sub-pages")}
        description={t("하위 페이지도 함께 공개 (각자의 Primary 버전)")}
        checked={includeSubPages}
        onChange={(e) => setIncludeSubPages(e.currentTarget.checked)}
        size="xs"
      />

      <Button
        fullWidth
        loading={createShareMutation.isPending}
        onClick={handleCreate}
      >
        {t("링크 생성")}
      </Button>
    </Stack>
  );
}

/** 링크 복사 — 체크 아이콘 전환 + 토스트로 성공을 분명히 알린다 */
function ShareCopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const clipboard = useClipboard({ timeout: 2000 });

  useEffect(() => {
    if (clipboard.copied) {
      notifications.show({
        message: t("공유 링크를 복사했습니다"),
        color: "teal",
      });
    }
  }, [clipboard.copied]);

  return (
    <Tooltip
      label={clipboard.copied ? t("Copied") : t("Copy")}
      position="top"
      withArrow
    >
      <ActionIcon
        color={clipboard.copied ? "teal" : "gray"}
        variant="subtle"
        onClick={() => clipboard.copy(text)}
      >
        {clipboard.copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
      </ActionIcon>
    </Tooltip>
  );
}

function ShareLinkList({
  shares,
  pageId,
  pageSlug,
  readOnly,
  onConfirmOpenChange,
}: {
  shares: IShare[];
  pageId: string;
  pageSlug: string;
  readOnly: boolean;
  onConfirmOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const deleteShareMutation = useDeleteShareMutation();

  // 고정 링크가 어느 버전을 가리키는지 목록에서 바로 알 수 있게 번호를 붙인다
  const hasFixed = shares.some((share) => share.versionMode === "fixed");
  const { data: versionsData } = usePageVersionsQuery(
    hasFixed ? pageId : undefined,
  );
  const versionNumberById = new Map<string, number>(
    (versionsData?.pages?.flatMap((p) => p.items) ?? []).map((v) => [
      v.id,
      v.version,
    ]),
  );

  const confirmDelete = (share: IShare) => {
    onConfirmOpenChange(true);
    modals.openConfirmModal({
      title: t("공유 링크 삭제"),
      // 팝오버 dropdown 보다 위에 떠야 한다
      zIndex: 1000,
      children: (
        <Text size="sm">
          {t(
            "이 공유 링크를 삭제합니다. 링크를 가진 사람은 더 이상 이 문서를 볼 수 없습니다.",
          )}
        </Text>
      ),
      labels: { confirm: t("삭제"), cancel: t("취소") },
      confirmProps: { color: "red" },
      onClose: () => onConfirmOpenChange(false),
      onConfirm: () => deleteShareMutation.mutate(share.id),
    });
  };

  if (shares.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        {t("공유된 링크가 없습니다")}
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      {shares.map((share) => {
        const publicLink = `${getAppUrl()}/share/${share.key}/p/${pageSlug}`;
        const isFixed = share.versionMode === "fixed";
        const fixedVersion = share.fixedVersionId
          ? versionNumberById.get(share.fixedVersionId)
          : undefined;
        return (
          <Card key={share.id} withBorder radius="md" padding="xs">
            <Group justify="space-between" wrap="nowrap" mb={4}>
              <Badge
                size="sm"
                variant="light"
                radius="sm"
                color={isFixed ? "grape" : "blue"}
              >
                {isFixed
                  ? fixedVersion !== undefined
                    ? t("버전 {{n}} 고정", { n: fixedVersion })
                    : t("버전 고정")
                  : t("최신 추종")}
              </Badge>
              {!readOnly && (
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={() => confirmDelete(share)}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              )}
            </Group>
            <Text size="xs" c="dimmed" mb={4}>
              {isFixed
                ? share.onDiscard === "404"
                  ? t("폐기 시 링크 차단(404)")
                  : t("폐기 시 가까운 버전으로 안내(fallback)")
                : t("Primary 버전이 바뀌면 자동 반영됩니다")}
            </Text>
            <Group gap={4} wrap="nowrap">
              <TextInput
                variant="filled"
                size="xs"
                value={publicLink}
                readOnly
                rightSection={<ShareCopyButton text={publicLink} />}
                style={{ width: "100%" }}
              />
              <ActionIcon
                component="a"
                variant="default"
                target="_blank"
                href={publicLink}
                size="sm"
              >
                <IconExternalLink size={16} />
              </ActionIcon>
            </Group>
          </Card>
        );
      })}
    </Stack>
  );
}
