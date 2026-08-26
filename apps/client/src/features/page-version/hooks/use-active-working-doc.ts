import { useAtomValue } from "jotai";
import {
  ActiveWorkingDoc,
  activeWorkingDocAtom,
} from "@/features/page-version/atoms/page-version-atoms";

/**
 * 「지금 편집 대상 작업문서가 무엇인가」를 정하는 **유일한 규칙**.
 *
 * 선택(atom)이 이 페이지 것이면 그 선택을, 아니면 기본(Primary) 작업문서를 본다.
 * 에디터가 여는 문서와 버전 패널이 칠하는 카드는 반드시 이 함수 하나에서
 * 나와야 한다 — 같은 식을 여기저기 복사해 두면 한쪽만 고쳐졌을 때
 * 「에디터가 보는 문서」와 「패널의 선택 하이라이트」가 어긋난다.
 */
export function resolveActiveWorkingDocId(
  activeWorkingDoc: ActiveWorkingDoc | null,
  pageId: string | null | undefined,
  primaryWorkingDocId: string | null | undefined,
): string | null {
  if (!pageId) return null;
  if (activeWorkingDoc?.pageId === pageId) return activeWorkingDoc.workingDocId;
  return primaryWorkingDocId ?? null;
}

export function useActiveWorkingDocId(
  pageId: string | null | undefined,
  primaryWorkingDocId: string | null | undefined,
): string | null {
  const activeWorkingDoc = useAtomValue(activeWorkingDocAtom);
  return resolveActiveWorkingDocId(
    activeWorkingDoc,
    pageId,
    primaryWorkingDocId,
  );
}
