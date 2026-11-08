import { useAtom } from "jotai";
import { atomWithWebStorage } from "@/lib/jotai-helper.ts";

/**
 * 사이드바 섹션의 접힘 상태 — 사용자별로 기억한다(localStorage).
 * 섹션마다 키가 하나라 atom 을 키별로 한 번만 만든다.
 */
const collapsedAtoms = new Map<
  string,
  ReturnType<typeof atomWithWebStorage<boolean>>
>();

function collapsedAtomFor(key: string) {
  if (!collapsedAtoms.has(key)) {
    collapsedAtoms.set(
      key,
      atomWithWebStorage<boolean>(`sidebar-collapsed:${key}`, false),
    );
  }
  return collapsedAtoms.get(key)!;
}

export function useSectionCollapsed(key: string) {
  return useAtom(collapsedAtomFor(key));
}
