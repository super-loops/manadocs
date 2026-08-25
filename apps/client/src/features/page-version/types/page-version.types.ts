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
  baseVersion?: { id: string; version: number; createdAt: string } | null;
  /**
   * base 버전과 내용이 다른가 — "작업중"(true) ↔ "원본"(false) 뱃지 판정.
   * 서버가 jsonb 비교로 내려준다. 협업 문서의 디바운스 저장본 기준이라 지금
   * 편집 중인 작업문서는 클라가 라이브 에디터로 덧씌운다.
   */
  modified?: boolean;
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
  /** 채택되지 않은 나머지 분기 삭제 여부 (생략 = 유지) */
  deleteOtherWorkingDocs?: boolean;
}

export interface ICreateWorkingDocInput {
  pageId: string;
  baseVersionId?: string;
  name?: string;
}

/** "이 버전으로 새 페이지" 응답 — 사이드바 트리에 꽂는 데 필요한 만큼 */
export interface IDuplicatedPage {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  position: string;
  spaceId: string;
  parentPageId: string | null;
}
