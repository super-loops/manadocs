import { useMemo } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { queryClient } from "@/main.tsx";
import { deleteAttachment } from "@/features/attachments/services/attachment-service.ts";
import {
  getSpaceAssets,
  getSpaceAssetStats,
  getSpaceOverview,
  getSpacePageVersionBadges,
  scanSpaceMaintenance,
} from "@/features/space/services/space-service.ts";
import {
  IPageVersionBadge,
  ISpaceOverview,
} from "@/features/space/types/space-overview.types.ts";
import {
  IOffsetPagination,
  ISpaceAsset,
  ISpaceAssetsParams,
  ISpaceAssetStats,
} from "@/features/space/types/space-assets.types.ts";
import { ISpaceMaintenanceScan } from "@/features/space/types/space-maintenance.types.ts";

export function useSpaceOverviewQuery(
  spaceId: string,
): UseQueryResult<ISpaceOverview, Error> {
  return useQuery({
    queryKey: ["space-overview", spaceId],
    queryFn: () => getSpaceOverview(spaceId),
    enabled: !!spaceId,
    staleTime: 60 * 1000,
  });
}

export function useSpaceAssetsQuery(
  params: ISpaceAssetsParams,
): UseQueryResult<IOffsetPagination<ISpaceAsset>, Error> {
  return useQuery({
    queryKey: ["space-assets", params],
    queryFn: () => getSpaceAssets(params),
    enabled: !!params.spaceId,
    placeholderData: keepPreviousData,
  });
}

export function useSpaceAssetStatsQuery(
  spaceId: string,
): UseQueryResult<ISpaceAssetStats, Error> {
  return useQuery({
    queryKey: ["space-asset-stats", spaceId],
    queryFn: () => getSpaceAssetStats(spaceId),
    enabled: !!spaceId,
    staleTime: 60 * 1000,
  });
}

/**
 * 에셋 브라우저에서 첨부파일을 영구 삭제한다.
 * 목록과 탭 카운트(stats)가 함께 어긋나므로 둘 다 무효화한다.
 */
export function useDeleteSpaceAssetMutation(spaceId: string) {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(attachmentId),
    onSuccess: () => {
      notifications.show({ message: t("파일을 삭제했습니다") });
      queryClient.invalidateQueries({ queryKey: ["space-assets"] });
      queryClient.invalidateQueries({
        queryKey: ["space-asset-stats", spaceId],
      });
    },
    onError: (error) => {
      const message =
        error["response"]?.data?.message || t("파일 삭제에 실패했습니다");
      notifications.show({ message, color: "red" });
    },
  });
}

export function useSpaceMaintenanceScanQuery(
  spaceId: string,
  enabled: boolean,
): UseQueryResult<ISpaceMaintenanceScan, Error> {
  return useQuery({
    queryKey: ["space-maintenance", spaceId],
    queryFn: () => scanSpaceMaintenance(spaceId),
    enabled: !!spaceId && enabled,
    // 스캔은 비싸니 명시적으로 새로고침할 때만 다시 돈다
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * 트리 hover 툴팁용 배지 맵. 스페이스당 한 번 받아 pageId 로 조회한다 —
 * hover 마다 요청하지 않으니 툴팁이 즉시 뜬다.
 */
export function usePageVersionBadgeMap(
  spaceId: string,
): Map<string, IPageVersionBadge> {
  const { data } = useQuery({
    queryKey: ["page-version-badges", spaceId],
    queryFn: () => getSpacePageVersionBadges(spaceId),
    enabled: !!spaceId,
    staleTime: 60 * 1000,
  });

  return useMemo(
    () => new Map((data?.items ?? []).map((item) => [item.pageId, item])),
    [data],
  );
}
