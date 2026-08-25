export const assetCategories = [
  "image",
  "video",
  "text",
  "archive",
  "other",
] as const;

export type AssetCategory = (typeof assetCategories)[number];

export type AssetSortField = "name" | "date" | "size";
export type AssetSortDirection = "asc" | "desc";

export interface IAssetCreator {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface IAssetPage {
  id: string;
  slugId: string;
  title: string | null;
}

export interface ISpaceAsset {
  id: string;
  fileName: string;
  filePath: string;
  fileExt: string;
  fileSize: number | null;
  mimeType: string | null;
  type: string | null;
  pageId: string | null;
  spaceId: string | null;
  createdAt: string;
  updatedAt: string;
  creator: IAssetCreator | null;
  page: IAssetPage | null;
}

export interface ISpaceAssetStats {
  totalCount: number;
  totalSize: number;
  recentCount: number;
  byCategory: Record<AssetCategory, number>;
}

export interface ISpaceAssetsParams {
  spaceId: string;
  category?: AssetCategory;
  query?: string;
  sort?: AssetSortField;
  direction?: AssetSortDirection;
  page?: number;
  limit?: number;
}

/** 서버 offset 페이지네이션 응답 */
export interface IOffsetPagination<T> {
  items: T[];
  meta: {
    limit: number;
    page: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
