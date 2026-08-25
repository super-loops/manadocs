import { useMemo } from "react";
import {
  keepPreviousData,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
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
