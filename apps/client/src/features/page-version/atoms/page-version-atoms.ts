import { atom } from "jotai";

/**
 * 현재 편집 중인 작업문서 선택.
 * null 이면 Primary 작업문서 (기본).
 * 페이지 이동 시 리셋을 위해 pageId 와 함께 보관.
 */
export type ActiveWorkingDoc = {
  pageId: string;
  workingDocId: string;
};

export const activeWorkingDocAtom = atom(null as ActiveWorkingDoc | null);

/** 확정(commit) 다이얼로그 열림 상태 */
export const commitDialogOpenAtom = atom<boolean>(false);

/** 미리보기 모달 — 보고 있는 버전 id (null 이면 닫힘) */
export const previewVersionIdAtom = atom(null as string | null);

export type DiffSelection = {
  pageId: string;
  /** null = 현재 작업문서(라이브) */
  leftVersionId: string | null;
  rightVersionId: string | null;
};

/** diff 뷰 — 비교 대상 (null 이면 닫힘) */
export const diffSelectionAtom = atom(null as DiffSelection | null);
