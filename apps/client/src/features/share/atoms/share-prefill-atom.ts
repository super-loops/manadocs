import { atom } from "jotai";

/**
 * "이 버전 공유" 진입점.
 * 미리보기(모달·새 창)에서 누르면 헤더의 공유 팝오버가 열리면서 "새로 만들기"
 * 탭이 **해당 버전 고정(fixed)** 으로 프리필된다. 공유 기능 자체는 그대로고
 * 여기 담기는 건 "어느 버전으로 열까" 하나뿐이다.
 */
export type SharePrefill = {
  pageId: string;
  fixedVersionId: string;
};

export const sharePrefillAtom = atom(null as SharePrefill | null);
