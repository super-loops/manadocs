import { atom } from "jotai";
import { ReviewStatus } from "@/features/review/types/review.types";

export const openReviewModalAtom = atom(null as string | null);

export const reviewSidebarOpenAtom = atom<boolean>(false);

export const reviewSidebarTabAtom = atom<ReviewStatus>("open");

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
