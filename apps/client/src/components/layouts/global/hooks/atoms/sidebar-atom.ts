import { atomWithWebStorage } from "@/lib/jotai-helper.ts";
import { atom } from "jotai";

export const mobileSidebarAtom = atom<boolean>(false);

export const desktopSidebarAtom = atomWithWebStorage<boolean>(
  "showSidebar",
  true,
);

export const desktopAsideAtom = atom<boolean>(false);

type AsideStateType = {
  tab: string;
  isAsideOpen: boolean;
};

/**
 * 우측 패널 상호배타 — 버전(aside)과 리뷰 사이드바는 동시에 열리지 않는다.
 *
 * 배타 규칙을 버튼 핸들러가 아니라 atom 의 쓰기 층에 뒀다. 두 패널은 툴바 버튼
 * 말고도 열린다(알림·앵커 클릭에서 리뷰 열기, 헤더 메뉴의 목차 aside, 페이지
 * 이동 시 aside 리셋 등). 어느 경로로 들어와도 "둘 다 열림" 상태가 만들어지지
 * 않도록 base atom 을 서로 직접 끈다.
 *
 * 리뷰 쪽 파생 atom 은 features/review/atoms/review-atom.ts 에 그대로 둔다
 * (import 순환을 피하려고 여기서는 base 만 내보낸다).
 */
export const asideStateBaseAtom = atom<AsideStateType>({
  tab: "",
  isAsideOpen: false,
});

export const reviewSidebarOpenBaseAtom = atom<boolean>(false);

export const asideStateAtom = atom(
  (get) => get(asideStateBaseAtom),
  (_get, set, next: AsideStateType) => {
    set(asideStateBaseAtom, next);
    if (next.isAsideOpen) set(reviewSidebarOpenBaseAtom, false);
  },
);

export const sidebarWidthAtom = atomWithWebStorage<number>('sidebarWidth', 300);
