import { IPage } from "@/features/page/types/page.types.ts";

export type ShareVersionMode = "primary" | "fixed";
export type ShareOnDiscard = "fallback" | "404";

export interface IShare {
  id: string;
  key: string;
  pageId: string;
  includeSubPages: boolean;
  searchIndexing: boolean;
  versionMode: ShareVersionMode;
  fixedVersionId: string | null;
  onDiscard: ShareOnDiscard;
  creatorId: string;
  spaceId: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  sharedPage?: ISharePage;
  creator?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

/** 공유 페이지 응답의 버전 컨텍스트 — 어떤 확정본이 서빙됐는지 */
export interface IShareVersionInfo {
  mode: ShareVersionMode;
  version: number;
  versionId: string;
  fallback: boolean;
}

export interface ISharedItem extends IShare {
  page: {
    id: string;
    title: string;
    slugId: string;
    icon: string | null;
  };
  space: {
    id: string;
    name: string;
    slug: string;
    userRole: string;
  };
  creator: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface ISharedPage extends IShare {
  page: IPage;
  share: IShare & {
    level: number;
    sharedPage: { id: string; slugId: string; title: string; icon: string };
  };
  versionInfo?: IShareVersionInfo;
  features?: string[];
}

export interface IShareForPage extends IShare {
  level: number;
  sharedPage: ISharePage;
}

interface ISharePage {
  id: string;
  slugId: string;
  title: string;
  icon: string;
}

export interface ICreateShare {
  pageId?: string;
  includeSubPages?: boolean;
  searchIndexing?: boolean;
  versionMode?: ShareVersionMode;
  fixedVersionId?: string;
  onDiscard?: ShareOnDiscard;
}

export type IUpdateShare = ICreateShare & { shareId: string; pageId?: string };

export interface IShareInfoInput {
  pageId: string;
  shareId?: string;
}

export interface ISharedPageTree {
  share: IShare;
  pageTree: Partial<IPage[]>;
  features?: string[];
}
