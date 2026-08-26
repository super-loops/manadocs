import { ISpaceAssetStats } from "@/features/space/types/space-assets.types.ts";

export interface ISpaceOverviewActor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  lastActiveAt: string;
  kind: "edit" | "commit" | "review";
}

export interface ISpaceOverviewRecentAsset {
  id: string;
  fileName: string;
  fileExt: string;
  fileSize: number | null;
  mimeType: string | null;
  pageId: string | null;
  createdAt: string;
  creator: { id: string; name: string | null; avatarUrl: string | null } | null;
  page: { id: string; slugId: string; title: string | null } | null;
}

export interface ISpaceOverview {
  pages: {
    total: number;
    committed: number;
    uncommitted: number;
    recentlyUpdated: number;
    trashed: number;
  };
  assets: ISpaceAssetStats;
  recentAssets: ISpaceOverviewRecentAsset[];
  actors: ISpaceOverviewActor[];
  activity: {
    recentCommits: number;
    openReviews: number;
    workingDocs: number;
  };
  recentSince: string;
}

/** 사이드바 트리 hover 툴팁용 페이지 배지 (분기코드는 클라에서 유도) */
export interface IPageVersionBadge {
  pageId: string;
  version: number | null;
  workingDocId: string | null;
  baseVersion: number | null;
  /** 툴팁 시각 2줄용 — footer pill 과 같은 계산에 쓰인다 */
  workingDocCreatedAt: string | null;
  workingDocUpdatedAt: string | null;
  baseVersionCreatedAt: string | null;
}

export interface IPageVersionBadges {
  items: IPageVersionBadge[];
  limit: number;
}
