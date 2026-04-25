import { atom } from "jotai";
import { ReviewStatus } from "@/features/review/types/review.types";

/** Sidebar에서 디테일 패널로 열린 review id. null이면 카드 목록을 보여준다. */
export const selectedReviewIdAtom = atom(null as string | null);

export const reviewSidebarOpenAtom = atom<boolean>(false);

export const reviewSidebarTabAtom = atom<ReviewStatus>("open");

/**
 * 외부(앵커 클릭, 알림 등)에서 사이드바를 띄우면서 특정 리뷰를 열 때 쓰는 입구.
 * write 시 selectedReviewId 와 sidebarOpen 을 함께 갱신한다.
 */
export const openReviewModalAtom = atom(
  (get) => get(selectedReviewIdAtom),
  (_get, set, reviewId: string | null) => {
    set(selectedReviewIdAtom, reviewId);
    set(reviewSidebarOpenAtom, !!reviewId);
  },
);

export const activeReviewAnchorIdAtom = atom(null as string | null);

export const draftReviewIdAtom = atom<string>("");

export type ReviewDraftSelection = {
  anchor: any;
  head: any;
};

export type ReviewDraftData = {
  yjsSelection: ReviewDraftSelection;
  selectedText: string;
};

export const reviewDraftDataAtom = atom(null as ReviewDraftData | null);
