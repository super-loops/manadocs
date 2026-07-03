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
  IPageVersion,
  IPageWorkingDoc,
} from "@/features/page-version/types/page-version.types";

function invalidateVersionQueries(pageId: string) {
  queryClient.invalidateQueries({ queryKey: ["page-versions", pageId] });
  queryClient.invalidateQueries({ queryKey: ["working-docs", pageId] });
  // Primary 변경은 /pages/info 의 primaryVersionId 에도 반영됨
  queryClient.invalidateQueries({ queryKey: ["pages"] });
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

export function useCommitVersionMutation(pageId: string) {
  return useMutation({
    mutationFn: (data: ICommitVersionInput) => commitVersion(data),
    onSuccess: (version) => {
      notifications.show({
        message: `문서버전 ${version.version} 확정됨`,
      });
      invalidateVersionQueries(pageId);
    },
    onError: (error: any) => {
      notifications.show({
        message:
          error?.response?.data?.message ?? "문서확정에 실패했습니다",
        color: "red",
      });
    },
  });
}

export function useDiscardVersionMutation(pageId: string) {
  return useMutation({
    mutationFn: (versionId: string) => discardVersion(versionId),
    onSuccess: () => {
      notifications.show({ message: "버전이 폐기되었습니다" });
      invalidateVersionQueries(pageId);
    },
    onError: (error: any) => {
      notifications.show({
        message: error?.response?.data?.message ?? "폐기에 실패했습니다",
        color: "red",
      });
    },
  });
}

export function useUndiscardVersionMutation(pageId: string) {
  return useMutation({
    mutationFn: (versionId: string) => undiscardVersion(versionId),
    onSuccess: () => {
      notifications.show({ message: "폐기가 해제되었습니다" });
      invalidateVersionQueries(pageId);
    },
  });
}

export function useSetPrimaryVersionMutation(pageId: string) {
  return useMutation({
    mutationFn: (versionId: string) => setPrimaryVersion(versionId),
    onSuccess: () => {
      notifications.show({ message: "Primary 버전이 변경되었습니다" });
      invalidateVersionQueries(pageId);
    },
    onError: (error: any) => {
      notifications.show({
        message:
          error?.response?.data?.message ?? "Primary 변경에 실패했습니다",
        color: "red",
      });
    },
  });
}

export function useDuplicateVersionMutation() {
  return useMutation({
    mutationFn: (versionId: string) => duplicateVersionAsPage(versionId),
    onSuccess: (page) => {
      notifications.show({
        message: `'${page.title || "새 페이지"}'(으)로 복제되었습니다`,
      });
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
    onError: (error: any) => {
      notifications.show({
        message: error?.response?.data?.message ?? "복제에 실패했습니다",
        color: "red",
      });
    },
  });
}

export function useCreateWorkingDocMutation(pageId: string) {
  return useMutation({
    mutationFn: (data: ICreateWorkingDocInput) => createWorkingDoc(data),
    onSuccess: () => {
      notifications.show({ message: "작업문서가 생성되었습니다" });
      invalidateVersionQueries(pageId);
    },
  });
}

export function useDeleteWorkingDocMutation(pageId: string) {
  return useMutation({
    mutationFn: (workingDocId: string) => deleteWorkingDoc(workingDocId),
    onSuccess: () => {
      notifications.show({ message: "작업문서가 삭제되었습니다" });
      invalidateVersionQueries(pageId);
    },
    onError: (error: any) => {
      notifications.show({
        message:
          error?.response?.data?.message ?? "작업문서 삭제에 실패했습니다",
        color: "red",
      });
    },
  });
}

export function useSetPrimaryWorkingDocMutation(pageId: string) {
  return useMutation({
    mutationFn: (workingDocId: string) => setPrimaryWorkingDoc(workingDocId),
    onSuccess: () => {
      notifications.show({ message: "Primary 작업문서가 변경되었습니다" });
      invalidateVersionQueries(pageId);
    },
  });
}

export function useResetWorkingDocMutation(pageId: string) {
  return useMutation({
    mutationFn: (workingDocId: string) => resetWorkingDoc(workingDocId),
    onSuccess: () => {
      notifications.show({ message: "수정사항이 취소되었습니다" });
      invalidateVersionQueries(pageId);
    },
  });
}
