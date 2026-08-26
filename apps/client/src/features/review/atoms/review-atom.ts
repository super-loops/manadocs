import { atom } from "jotai";
import { ReviewStatus } from "@/features/review/types/review.types";
import {
  asideStateBaseAtom,
  reviewSidebarOpenBaseAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";

/** Sidebar에서 디테일 패널로 열린 review id. null이면 카드 목록을 보여준다. */
export const selectedReviewIdAtom = atom(null as string | null);

/**
 * 리뷰 사이드바 열림 — 버전(aside) 패널과 상호배타다. 리뷰를 켜면 aside 를 끈다.
 * 배타 규칙의 반대 방향(aside 를 켜면 리뷰를 끈다)은 asideStateAtom 쓰기 층에
 * 있다. 어느 쪽 경로로 열어도 "둘 다 열림"이 만들어지지 않는다.
 */
export const reviewSidebarOpenAtom = atom(
  (get) => get(reviewSidebarOpenBaseAtom),
  (get, set, update: boolean | ((prev: boolean) => boolean)) => {
    const next =
      typeof update === "function"
        ? update(get(reviewSidebarOpenBaseAtom))
        : update;
    set(reviewSidebarOpenBaseAtom, next);
    if (next) set(asideStateBaseAtom, { tab: "", isAsideOpen: false });
  },
);

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
