import { useEffect, useState } from "react";
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Code,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconCopy,
  IconCrown,
  IconDots,
  IconDownload,
  IconEye,
  IconFileText,
  IconGitBranch,
  IconGitCompare,
  IconJson,
  IconPencil,
  IconRestore,
  IconTrash,
  IconTrashX,
} from "@tabler/icons-react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { modals } from "@mantine/modals";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { useTimeAgo } from "@/hooks/use-time-ago";
import {
  usePageVersionsQuery,
  usePageVersionQuery,
  useCreateWorkingDocMutation,
  useDeleteWorkingDocMutation,
  useDiscardVersionMutation,
  useDuplicateVersionMutation,
  useResetWorkingDocMutation,
  useSetPrimaryVersionMutation,
  useSetPrimaryWorkingDocMutation,
  useUndiscardVersionMutation,
  useWorkingDocsWithStatusQuery,
} from "@/features/page-version/queries/page-version-query";
import { getPageVersionInfo } from "@/features/page-version/services/page-version-service";
import {
  downloadVersionJson,
  downloadVersionMarkdown,
} from "@/features/page-version/utils/download-version";
import {
  IPageVersion,
  IPageWorkingDoc,
} from "@/features/page-version/types/page-version.types";
import {
  activeWorkingDocAtom,
  diffSelectionAtom,
  previewVersionIdAtom,
} from "@/features/page-version/atoms/page-version-atoms";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { computeUncommittedStats } from "@/features/page-version/utils/working-diff";
import { getBranchCode } from "@/lib/branch-code";
import { usePageQuery } from "@/features/page/queries/page-query";
import { extractPageSlugId } from "@/lib";
import { useParams } from "react-router-dom";

const MAX_VISIBLE_AVATARS = 3;

/**
 * 버전 + 작업문서 결합 패널.
 * 확정 버전 카드 목록을 세로로 놓고, **각 버전 카드 아래에 그 버전을 base 로
 * 삼는 작업문서(분기)들을 들여쓰기로** 붙인다. 어느 확정본에서 갈라진
 * 분기인지가 목록 모양 그대로 드러나게 하는 게 목적이라, 예전처럼 버전/작업문서
 * 탭을 갈라놓지 않는다.
 */
export default function VersionPanel() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });

  const pageId = page?.id;
  const canEdit = page?.permissions?.canEdit ?? false;
  const primaryVersionId = page?.primaryVersionId ?? null;
  const primaryWorkingDocId = page?.primaryWorkingDocId ?? null;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    usePageVersionsQuery(pageId);
  const { data: workingDocs } = useWorkingDocsWithStatusQuery(pageId, canEdit);
  const createMutation = useCreateWorkingDocMutation(pageId);

  const versions: IPageVersion[] = data?.pages?.flatMap((p) => p.items) ?? [];

  if (!pageId) return null;

  // 작업문서를 base 버전별로 묶는다. 버전 목록은 페이지네이션이라 아직 안 실린
  // 버전을 base 로 둔 분기가 있을 수 있고, 그건 맨 아래 별도 묶음으로 뺀다.
  const markerVersionId =
    versions.find((version) => version.version === 0)?.id ?? null;
  const loadedVersionIds = new Set(versions.map((version) => version.id));
  const docsByBase = new Map<string, IPageWorkingDoc[]>();
  const strayDocs: IPageWorkingDoc[] = [];

  for (const doc of workingDocs ?? []) {
    // base 가 없는 문서(미확정 페이지의 최초 작업문서)는 생성 마커 아래에 둔다
    const baseId = doc.baseVersionId ?? markerVersionId;
    if (baseId && loadedVersionIds.has(baseId)) {
      const bucket = docsByBase.get(baseId);
      if (bucket) bucket.push(doc);
      else docsByBase.set(baseId, [doc]);
    } else {
      strayDocs.push(doc);
    }
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="nowrap">
        <Text size="xs" c="dimmed">
          {canEdit
            ? t("버전 {{v}}개 · 작업문서 {{w}}개", {
                v: versions.length,
                w: workingDocs?.length ?? 0,
              })
            : t("{{count}}개의 버전", { count: versions.length })}
        </Text>
        {canEdit && (
          <Button
            size="compact-xs"
            variant="subtle"
            leftSection={<IconGitBranch size={14} />}
            onClick={() => createMutation.mutate({ pageId })}
          >
            {t("새 작업문서")}
          </Button>
        )}
      </Group>

      {versions.map((version) => (
        <Stack key={version.id} gap={4}>
          <VersionCard
            version={version}
            pageId={pageId}
            isPrimary={version.id === primaryVersionId}
            canEdit={canEdit}
          />
          <WorkingDocBranch
            docs={docsByBase.get(version.id) ?? []}
            pageId={pageId}
            primaryWorkingDocId={primaryWorkingDocId}
          />
        </Stack>
      ))}

      {strayDocs.length > 0 && (
        <Stack gap={4} mt="xs">
          <Text size="xs" c="dimmed">
            {t("이전 버전에서 시작한 작업문서")}
          </Text>
          <WorkingDocBranch
            docs={strayDocs}
            pageId={pageId}
            primaryWorkingDocId={primaryWorkingDocId}
          />
        </Stack>
      )}

      {hasNextPage && (
        <Button
          variant="subtle"
          size="xs"
          loading={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {t("더 보기")}
        </Button>
      )}
    </Stack>
  );
}

/** 버전 카드에 매달린 분기 묶음 — 들여쓰기 + 세로선으로 소속을 보인다 */
function WorkingDocBranch({
  docs,
  pageId,
  primaryWorkingDocId,
}: {
  docs: IPageWorkingDoc[];
  pageId: string;
  primaryWorkingDocId: string | null;
}) {
  if (docs.length === 0) return null;

  return (
    <Box
      ml="md"
      pl="xs"
      style={{ borderLeft: "2px solid var(--mantine-color-default-border)" }}
    >
      <Stack gap={4}>
        {docs.map((doc) => (
          <WorkingDocRow
            key={doc.id}
            workingDoc={doc}
            pageId={pageId}
            isPrimary={doc.id === primaryWorkingDocId}
          />
        ))}
      </Stack>
    </Box>
  );
}

function VersionCard({
  version,
  pageId,
  isPrimary,
  canEdit,
}: {
  version: IPageVersion;
  pageId: string;
  isPrimary: boolean;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const setPrimaryMutation = useSetPrimaryVersionMutation(pageId);
  const discardMutation = useDiscardVersionMutation(pageId);
  const undiscardMutation = useUndiscardVersionMutation(pageId);
  const duplicateMutation = useDuplicateVersionMutation();
  const createWorkingDocMutation = useCreateWorkingDocMutation(pageId);
  const setActiveWorkingDoc = useSetAtom(activeWorkingDocAtom);
  const setPreviewVersionId = useSetAtom(previewVersionIdAtom);
  const [, setDiffSelection] = useAtom(diffSelectionAtom);

  const isDiscarded = !!version.discardedAt;
  const isMarker = version.version === 0;
  // 공용 틱 훅 — 카드마다 상대시간이 함께 갱신돼 기준 시점이 어긋나지 않는다
  const createdAtAgo = useTimeAgo(version.createdAt);

  // 다운로드는 content 가 필요 — 카드는 경량이라 클릭 시 상세 fetch
  const handleDownload = async (format: "json" | "md") => {
    const full = await getPageVersionInfo(version.id);
    if (format === "json") downloadVersionJson(full);
    else downloadVersionMarkdown(full);
  };

  return (
    <Card
      withBorder
      radius="md"
      padding="sm"
      style={
        isPrimary
          ? {
              borderColor: "var(--mantine-color-blue-5)",
              backgroundColor: "var(--mantine-color-blue-0)",
            }
          : isDiscarded
            ? { backgroundColor: "var(--mantine-color-gray-0)" }
            : undefined
      }
    >
      <Group justify="space-between" wrap="nowrap" mb={6}>
        <Group gap={6} wrap="nowrap">
          {isPrimary && (
            <Badge size="sm" variant="light" color="blue" radius="sm">
              Primary
            </Badge>
          )}
          {isDiscarded && (
            <Badge size="sm" variant="light" color="gray" radius="sm">
              {t("폐기됨")}
            </Badge>
          )}
        </Group>

        <Group gap={4} wrap="nowrap">
          <Text size="sm" fw={500} c={isDiscarded ? "dimmed" : undefined}>
            {isMarker
              ? t("버전 0 · 초기")
              : t("버전 {{n}}", { n: version.version })}
          </Text>

          {/* 미리보기는 ⋯ 안에 묻지 않고 바로 누를 수 있게 밖으로 뺐다 */}
          {!isMarker && (
            <Tooltip label={t("미리보기")} openDelay={300} withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={t("미리보기")}
                onClick={() => setPreviewVersionId(version.id)}
              >
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
          )}

          {canEdit && !isMarker && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="sm">
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {!isDiscarded && !isPrimary && (
                  <Menu.Item
                    leftSection={<IconCrown size={14} />}
                    onClick={() => setPrimaryMutation.mutate(version.id)}
                  >
                    {t("Primary로 변경")}
                  </Menu.Item>
                )}
                <Menu.Item
                  leftSection={<IconGitBranch size={14} />}
                  onClick={() =>
                    createWorkingDocMutation.mutate(
                      { pageId, baseVersionId: version.id },
                      {
                        // 만들어만 두고 가만히 있으면 유저가 한 번 더 찾아
                        // 눌러야 한다 — 만든 분기로 바로 편집을 옮긴다.
                        onSuccess: (created) =>
                          setActiveWorkingDoc({
                            pageId,
                            workingDocId: created.id,
                          }),
                      },
                    )
                  }
                >
                  {t("이 버전에서 작업 시작")}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconGitCompare size={14} />}
                  onClick={() =>
                    setDiffSelection({
                      pageId,
                      leftVersionId: null,
                      rightVersionId: version.id,
                    })
                  }
                >
                  {t("비교(DIFF)")}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconCopy size={14} />}
                  onClick={() => duplicateMutation.mutate(version.id)}
                >
                  {t("이 버전으로 새 페이지")}
                </Menu.Item>
                <Menu.Sub>
                  <Menu.Sub.Target>
                    <Menu.Sub.Item leftSection={<IconDownload size={14} />}>
                      {t("다운로드")}
                    </Menu.Sub.Item>
                  </Menu.Sub.Target>
                  <Menu.Sub.Dropdown>
                    <Menu.Item
                      leftSection={<IconFileText size={14} />}
                      onClick={() => handleDownload("md")}
                    >
                      Markdown (.md)
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconJson size={14} />}
                      onClick={() => handleDownload("json")}
                    >
                      JSON (.json)
                    </Menu.Item>
                  </Menu.Sub.Dropdown>
                </Menu.Sub>
                {!isDiscarded ? (
                  <Menu.Item
                    color="red"
                    leftSection={<IconTrashX size={14} />}
                    onClick={() => discardMutation.mutate(version.id)}
                  >
                    {t("폐기")}
                  </Menu.Item>
                ) : (
                  <Menu.Item
                    leftSection={<IconRestore size={14} />}
                    onClick={() => undiscardMutation.mutate(version.id)}
                  >
                    {t("폐기 해제")}
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Group>

      <Text
        size="sm"
        lineClamp={2}
        td={isDiscarded ? "line-through" : undefined}
        c={isDiscarded ? "dimmed" : undefined}
      >
        {version.message || t("(메시지 없음)")}
      </Text>

      <Group gap={8} mt={8} wrap="nowrap">
        {version.creator && (
          <>
            <CustomAvatar
              size={24}
              avatarUrl={version.creator.avatarUrl}
              name={version.creator.name}
            />
            <Text size="xs" c="dimmed">
              {version.creator.name} · {createdAtAgo}
            </Text>
          </>
        )}
      </Group>
    </Card>
  );
}

/**
 * 지금 편집 중인 작업문서만 라이브 에디터로 "원본/작업중" 을 다시 판정한다.
 * 서버 flag 는 협업 문서의 디바운스(최대 10초) 저장본 기준이라, 수정취소
 * 직후에도 한동안 "작업중" 으로 남는다 — 그 잔상을 여기서 지운다.
 * 판정 불가(기준 버전 로딩 중 · content 없는 생성 마커)면 null 을 돌려
 * 서버 flag 로 떨어지게 한다.
 */
function useLiveModified(
  baseVersionId: string | null,
  enabled: boolean,
): boolean | null {
  const editor = useAtomValue(pageEditorAtom);
  const { data: baseVersion } = usePageVersionQuery(
    enabled ? baseVersionId : null,
  );
  const [modified, setModified] = useState<boolean | null>(null);
  const baseContent = baseVersion?.content ?? null;
  // base 가 아예 없는 분기(확정본 없는 페이지)는 빈 문서 대비로 판정한다 —
  // "기준 버전 로딩 중"과 구분해야 갓 만든 페이지가 서버 응답을 기다리며
  // 엉뚱한 뱃지를 달지 않는다.
  const awaitingBase = !!baseVersionId && !baseContent;

  useEffect(() => {
    if (!enabled || !editor || editor.isDestroyed || awaitingBase) {
      setModified(null);
      return;
    }

    const recompute = () => {
      if (!editor || editor.isDestroyed) return;
      // footer pill·사이드바 "수정중" 과 같은 함수로 판정한다
      const stats = computeUncommittedStats(
        editor,
        baseContent,
        editor.getJSON(),
      );
      setModified(stats.total > 0);
    };

    recompute();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(recompute, 400);
    };
    editor.on("update", onUpdate);
    return () => {
      if (timer) clearTimeout(timer);
      try {
        editor.off("update", onUpdate);
      } catch {
        // editor 정리됨
      }
    };
  }, [editor, baseContent, enabled, awaitingBase]);

  return modified;
}

function WorkingDocRow({
  workingDoc,
  pageId,
  isPrimary,
}: {
  workingDoc: IPageWorkingDoc;
  pageId: string;
  isPrimary: boolean;
}) {
  const { t } = useTranslation();
  const [activeWorkingDoc, setActiveWorkingDoc] = useAtom(activeWorkingDocAtom);
  const setPrimaryMutation = useSetPrimaryWorkingDocMutation(pageId);
  const deleteMutation = useDeleteWorkingDocMutation(pageId);
  const resetMutation = useResetWorkingDocMutation(pageId);
  // 공용 틱 훅 — 버전 카드와 같은 기준 시점으로 상대시간을 갱신한다
  const updatedAtAgo = useTimeAgo(workingDoc.updatedAt);

  const isActive =
    activeWorkingDoc?.pageId === pageId
      ? activeWorkingDoc.workingDocId === workingDoc.id
      : isPrimary;

  const liveModified = useLiveModified(workingDoc.baseVersionId, isActive);
  const isModified = liveModified ?? workingDoc.modified ?? false;

  const branchCode = getBranchCode(workingDoc.id);
  const contributors = workingDoc.contributors ?? [];
  const displayName =
    workingDoc.name ||
    (workingDoc.baseVersion
      ? t("버전 {{n}}에서 시작", { n: workingDoc.baseVersion.version })
      : t("작업문서"));

  // 어느 버전으로 되돌아가는지 번호로 못박는다 — 서버도 이 분기의 base 로
  // 되돌린다(Primary 가 아니라). 번호를 안 보여주면 유저가 확인할 방법이 없다.
  const confirmReset = () =>
    modals.openConfirmModal({
      title: t("수정취소"),
      children: (
        <Text size="sm">
          {workingDoc.baseVersion
            ? t(
                "이 작업문서의 수정사항을 모두 되돌리고 버전 {{n}} 내용으로 리셋합니다. 계속할까요?",
                { n: workingDoc.baseVersion.version },
              )
            : t(
                "이 작업문서의 수정사항을 모두 되돌리고 기준 버전 내용으로 리셋합니다. 계속할까요?",
              )}
        </Text>
      ),
      labels: { confirm: t("수정취소"), cancel: t("취소") },
      confirmProps: { color: "red" },
      onConfirm: () => resetMutation.mutate(workingDoc.id),
    });

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: t("작업문서 삭제"),
      children: (
        <Text size="sm">
          {t("이 작업문서를 삭제합니다. 확정되지 않은 수정사항은 사라집니다.")}
        </Text>
      ),
      labels: { confirm: t("삭제"), cancel: t("취소") },
      confirmProps: { color: "red" },
      onConfirm: () => deleteMutation.mutate(workingDoc.id),
    });

  return (
    <Card
      withBorder
      radius="sm"
      padding={8}
      style={
        isActive
          ? { borderColor: "var(--mantine-color-blue-5)" }
          : { borderStyle: "dashed" }
      }
    >
      <Group gap={6} wrap="nowrap" align="center">
        <Tooltip label={t("분기코드")} openDelay={400} withArrow>
          <Code fz={10} px={4}>
            {branchCode}
          </Code>
        </Tooltip>

        <Text size="xs" fw={500} lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
          {displayName}
        </Text>

        {/* 원클릭 전환 — ⋯ 를 열지 않고 바로 이 분기로 편집을 옮긴다 */}
        {isActive ? (
          <Badge size="xs" variant="light" color="blue" radius="sm">
            {t("편집 중")}
          </Badge>
        ) : (
          <Tooltip label={t("이 작업문서로 편집")} openDelay={300} withArrow>
            <ActionIcon
              variant="subtle"
              color="blue"
              size="sm"
              aria-label={t("이 작업문서로 편집")}
              onClick={() =>
                setActiveWorkingDoc({ pageId, workingDocId: workingDoc.id })
              }
            >
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
        )}

        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" size="sm">
              <IconDots size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {!isActive && (
              <Menu.Item
                leftSection={<IconPencil size={14} />}
                onClick={() =>
                  setActiveWorkingDoc({ pageId, workingDocId: workingDoc.id })
                }
              >
                {t("이 작업문서로 편집")}
              </Menu.Item>
            )}
            {!isPrimary && (
              <Menu.Item
                leftSection={<IconCrown size={14} />}
                onClick={() => setPrimaryMutation.mutate(workingDoc.id)}
              >
                {t("기본 작업문서로 지정")}
              </Menu.Item>
            )}
            <Menu.Item
              leftSection={<IconRestore size={14} />}
              onClick={confirmReset}
            >
              {t("수정취소")}
            </Menu.Item>
            {!isPrimary && (
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={confirmDelete}
              >
                {t("삭제")}
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Group gap={6} mt={6} wrap="nowrap" justify="space-between">
        <Group gap={4} wrap="nowrap">
          {/* 버전의 Primary(= 독자에게 보이는 확정본)와 뜻이 다르다. 이건
              "선택이 없을 때 기본으로 열리는 분기" 라 다른 말을 쓴다. */}
          {isPrimary && (
            <Tooltip
              label={t("선택이 없을 때 기본으로 열리는 작업문서")}
              openDelay={400}
              withArrow
            >
              <Badge size="xs" variant="light" color="blue" radius="sm">
                {t("기본")}
              </Badge>
            </Tooltip>
          )}
          <Badge
            size="xs"
            variant="light"
            radius="sm"
            color={isModified ? "yellow" : "gray"}
          >
            {isModified ? t("작업중") : t("원본")}
          </Badge>
        </Group>

        <Group gap={6} wrap="nowrap">
          {contributors.length > 0 ? (
            <Tooltip.Group openDelay={300} closeDelay={100}>
              <Avatar.Group spacing={6}>
                {contributors.slice(0, MAX_VISIBLE_AVATARS).map((user) => (
                  <Tooltip key={user.id} label={user.name} withArrow>
                    <CustomAvatar
                      size={20}
                      avatarUrl={user.avatarUrl}
                      name={user.name}
                    />
                  </Tooltip>
                ))}
                {contributors.length > MAX_VISIBLE_AVATARS && (
                  <Avatar size={20} radius="xl">
                    +{contributors.length - MAX_VISIBLE_AVATARS}
                  </Avatar>
                )}
              </Avatar.Group>
            </Tooltip.Group>
          ) : (
            workingDoc.creator && (
              <CustomAvatar
                size={20}
                avatarUrl={workingDoc.creator.avatarUrl}
                name={workingDoc.creator.name}
              />
            )
          )}
          <Text size="xs" c="dimmed">
            {updatedAtAgo}
          </Text>
        </Group>
      </Group>
    </Card>
  );
}
