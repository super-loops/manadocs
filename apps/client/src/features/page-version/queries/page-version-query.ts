import {
  InfiniteData,
  useInfiniteQuery,
  UseInfiniteQueryResult,
  useMutation,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { IPagination } from "@/lib/types.ts";
import { queryClient } from "@/main";
import {
  commitVersion,
  createWorkingDoc,
  deleteWorkingDoc,
  discardVersion,
  duplicateVersionAsPage,
  getPageVersionByNumber,
  getPageVersionInfo,
  getPageVersions,
  getWorkingDocs,
  resetWorkingDoc,
  setPrimaryVersion,
  setPrimaryWorkingDoc,
  undiscardVersion,
} from "@/features/page-version/services/page-version-service";
import {
  ICommitVersionInput,
  ICreateWorkingDocInput,
  IDuplicatedPage,
  IPageVersion,
  IPageWorkingDoc,
} from "@/features/page-version/types/page-version.types";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { useSetAtom } from "jotai";
import { activeWorkingDocAtom } from "@/features/page-version/atoms/page-version-atoms";
import { SimpleTree } from "react-arborist";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { markOptimisticPageCreation } from "@/features/page/tree/optimistic-tracker.ts";

/** 새로 만들어진 페이지를 현재 스페이스 트리에 끼워넣는다(중복은 무시). */
function insertPageIntoTree(
  treeData: SpaceTreeNode[],
  setTreeData: (value: SpaceTreeNode[]) => void,
  page: IDuplicatedPage,
) {
  const treeApi = new SimpleTree<SpaceTreeNode>(treeData);
  if (treeApi.find(page.id)) return;

  const parentId = page.parentPageId || null;
  if (parentId && !treeApi.find(parentId)) return; // 다른 스페이스/미로드 구간

  markOptimisticPageCreation(page.id);
  treeApi.create({
    parentId,
    index: 0,
    data: {
      id: page.id,
      slugId: page.slugId,
      name: page.title || "",
      icon: page.icon,
      position: page.position,
      spaceId: page.spaceId,
      parentPageId: page.parentPageId,
      hasChildren: false,
      children: [],
    } as SpaceTreeNode,
  });
  setTreeData([...treeApi.data]);
}

function invalidateVersionQueries(pageId: string) {
  queryClient.invalidateQueries({ queryKey: ["page-versions", pageId] });
  queryClient.invalidateQueries({ queryKey: ["working-docs", pageId] });
  // Primary 변경은 /pages/info 의 primaryVersionId 에도 반영됨
  queryClient.invalidateQueries({ queryKey: ["pages"] });
  // 사이드바 "수정중" 섹션 — 확정·폐기·리셋이면 목록에서 빠져야 한다
  queryClient.invalidateQueries({ queryKey: ["working-changes"] });
}

export function usePageVersionsQuery(
  pageId: string | undefined,
): UseInfiniteQueryResult<InfiniteData<IPagination<IPageVersion>, unknown>> {
  return useInfiniteQuery({
    queryKey: ["page-versions", pageId],
    queryFn: ({ pageParam }) => getPageVersions(pageId, pageParam),
    enabled: !!pageId,
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.meta?.nextCursor ?? undefined,
  });
}

export function usePageVersionQuery(
  versionId: string | null,
): UseQueryResult<IPageVersion, Error> {
  return useQuery({
    queryKey: ["page-version", versionId],
    queryFn: () => getPageVersionInfo(versionId),
    enabled: !!versionId,
    staleTime: 60 * 60 * 1000,
  });
}

/** 버전 번호로 확정본 — 새 창 미리보기 라우트가 쓴다(URL 에 uuid 대신 번호) */
export function usePageVersionByNumberQuery(
  pageId: string | undefined,
  version: number | null,
): UseQueryResult<IPageVersion, Error> {
  return useQuery({
    queryKey: ["page-version-by-number", pageId, version],
    queryFn: () => getPageVersionByNumber(pageId, version),
    enabled: !!pageId && version !== null && Number.isFinite(version),
    staleTime: 60 * 60 * 1000,
  });
}

export function useWorkingDocsQuery(
  pageId: string,
  enabled = true,
): UseQueryResult<IPageWorkingDoc[], Error> {
  return useQuery({
    queryKey: ["working-docs", pageId],
    queryFn: () => getWorkingDocs(pageId),
    enabled: !!pageId && enabled,
  });
}

/**
 * 결합 패널 전용 — 원본/작업중 뱃지에 쓸 `modified` 를 함께 받는다.
 * 서버가 content 를 읽어야 하는 무거운 쪽이라 패널이 열릴 때만 부른다
 * (footer pill 은 위의 가벼운 쿼리를 계속 쓴다).
 * 키가 ["working-docs", pageId] 로 시작해 기존 무효화가 그대로 걸린다.
 */
export function useWorkingDocsWithStatusQuery(
  pageId: string,
  enabled = true,
): UseQueryResult<IPageWorkingDoc[], Error> {
  return useQuery({
    queryKey: ["working-docs", pageId, "with-status"],
    queryFn: () => getWorkingDocs(pageId, true),
    enabled: !!pageId && enabled,
  });
}

export function useCommitVersionMutation(pageId: string) {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: ICommitVersionInput) => commitVersion(data),
    onSuccess: (version) => {
      notifications.show({
        message: t("문서버전 {{n}} 확정됨", { n: version.version }),
      });
      invalidateVersionQueries(pageId);
    },
    // 실패 표시는 commit-dialog 가 맡는다 — 모달 안에 이유를 띄우고
    // 모달을 열어둔 채로 다시 시도하게 한다(토스트와 이중 보고하지 않는다).
  });
}

export function useDiscardVersionMutation(pageId: string) {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (versionId: string) => discardVersion(versionId),
    onSuccess: () => {
      notifications.show({ message: t("버전이 폐기되었습니다") });
      invalidateVersionQueries(pageId);
    },
    onError: (error: any) => {
      notifications.show({
        message: error?.response?.data?.message ?? t("폐기에 실패했습니다"),
        color: "red",
      });
    },
  });
}

export function useUndiscardVersionMutation(pageId: string) {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (versionId: string) => undiscardVersion(versionId),
    onSuccess: () => {
      notifications.show({ message: t("폐기가 해제되었습니다") });
      invalidateVersionQueries(pageId);
    },
  });
}

export function useSetPrimaryVersionMutation(pageId: string) {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (versionId: string) => setPrimaryVersion(versionId),
    onSuccess: () => {
      notifications.show({ message: t("Primary 버전이 변경되었습니다") });
      invalidateVersionQueries(pageId);
    },
    onError: (error: any) => {
      notifications.show({
        message:
          error?.response?.data?.message ?? t("Primary 변경에 실패했습니다"),
        color: "red",
      });
    },
  });
}

export function useDuplicateVersionMutation() {
  const { t } = useTranslation();
  const [treeData, setTreeData] = useAtom(treeDataAtom);

  return useMutation({
    mutationFn: (versionId: string) => duplicateVersionAsPage(versionId),
    onSuccess: (page) => {
      notifications.show({
        // 조사(으)로 표기를 피해 조사 없이 읽히는 문장으로
        message: t("'{{title}}' 페이지를 만들었습니다", {
          title: page.title || t("untitled"),
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      // 사이드바 트리 즉시 반영 — 서버도 addTreeNode 를 브로드캐스트하지만
      // 소켓 왕복을 기다리지 않도록 복제한 본인 화면에는 낙관적으로 꽂는다
      // (WS 핸들러가 id 로 중복을 걸러낸다).
      insertPageIntoTree(treeData, setTreeData, page);
    },
    onError: (error: any) => {
      notifications.show({
        message: error?.response?.data?.message ?? t("복제에 실패했습니다"),
        color: "red",
      });
    },
  });
}

export function useCreateWorkingDocMutation(pageId: string) {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: ICreateWorkingDocInput) => createWorkingDoc(data),
    onSuccess: () => {
      notifications.show({ message: t("작업문서가 생성되었습니다") });
      invalidateVersionQueries(pageId);
    },
  });
}

export function useDeleteWorkingDocMutation(pageId: string) {
  const { t } = useTranslation();
  const setActiveWorkingDoc = useSetAtom(activeWorkingDocAtom);

  return useMutation({
    mutationFn: (workingDocId: string) => deleteWorkingDoc(workingDocId),
    onSuccess: (_, workingDocId) => {
      notifications.show({ message: t("작업문서가 삭제되었습니다") });
      // 「삭제하면 어디로 돌아가는가」를 **여기서 하나로 확정한다**: 기본(Primary)
      // 작업문서. 선택을 비우면 resolveActiveWorkingDocId 가 기본으로 떨어진다.
      // 이걸 안 비우면 atom 이 삭제된 id 를 계속 가리켜서, 패널은 어느 카드도
      // 선택되지 않은 것처럼 보이고 에디터는 삭제된 문서를 계속 열어 둔다.
      setActiveWorkingDoc((prev) =>
        prev?.pageId === pageId && prev.workingDocId === workingDocId
          ? null
          : prev,
      );
      invalidateVersionQueries(pageId);
    },
    onError: (error: any) => {
      notifications.show({
        message:
          error?.response?.data?.message ?? t("작업문서 삭제에 실패했습니다"),
        color: "red",
      });
    },
  });
}

export function useSetPrimaryWorkingDocMutation(pageId: string) {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (workingDocId: string) => setPrimaryWorkingDoc(workingDocId),
    onSuccess: () => {
      notifications.show({ message: t("Primary 작업문서가 변경되었습니다") });
      invalidateVersionQueries(pageId);
    },
  });
}

export function useResetWorkingDocMutation(pageId: string) {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (workingDocId: string) => resetWorkingDoc(workingDocId),
    onSuccess: () => {
      notifications.show({ message: t("수정사항이 취소되었습니다") });
      invalidateVersionQueries(pageId);
    },
  });
}
