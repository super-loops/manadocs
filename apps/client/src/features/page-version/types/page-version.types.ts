export interface IVersionUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface IPageVersion {
  id: string;
  pageId: string;
  version: number;
  title: string | null;
  icon: string | null;
  coverPhoto: string | null;
  content?: any;
  message: string | null;
  creatorId: string | null;
  contributorIds: string[];
  workingDocId: string | null;
  discardedAt: string | null;
  discardedById: string | null;
  spaceId: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  creator?: IVersionUser;
  contributors?: IVersionUser[];
}

export interface IPageWorkingDoc {
  id: string;
  pageId: string;
  name: string | null;
  baseVersionId: string | null;
  creatorId: string | null;
  contributorIds: string[];
  spaceId: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  creator?: IVersionUser;
  contributors?: IVersionUser[];
  baseVersion?: { id: string; version: number } | null;
}

/** Reader 가 확정본을 볼 때 /pages/info 가 내려주는 컨텍스트 */
export interface IVersionContext {
  mode: "committed";
  hasCommitted: boolean;
  version: number | null;
  versionId: string | null;
}

export interface ICommitVersionInput {
  pageId: string;
  workingDocId?: string;
  message?: string;
}

export interface ICreateWorkingDocInput {
  pageId: string;
  baseVersionId?: string;
  name?: string;
}
