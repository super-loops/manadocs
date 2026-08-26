import { atom } from "jotai";
import { Editor } from "@tiptap/core";

export const pageEditorAtom = atom<Editor | null>(null);

/**
 * pageEditorAtom 의 문서를 **믿어도 되는가**.
 *
 * PageEditor 는 협업 문서가 붙기 전까지 캐시 본문을 그린 정적 에디터를 보여주는데,
 * 그동안에도 collab 에디터는 이미 만들어져 pageEditorAtom 에 실린다 — 내용이
 * **빈** 채로. 이 빈 문서를 확정본과 비교하면 아무것도 안 고쳤는데 «−N» 이 잡혀
 * 사이드바 "수정중" 에 유령이 떴다 사라진다(N-8).
 *
 * 그래서 미확정 판정(footer pill · 사이드바 수정중 · 결합 패널 뱃지)은 반드시
 * 이 값이 true 일 때만 한다. 한 번 true 가 되면 페이지를 옮기기 전까지 유지된다.
 */
export const pageEditorContentReadyAtom = atom(false);

export const titleEditorAtom = atom<Editor | null>(null);

export const readOnlyEditorAtom = atom<Editor | null>(null);

export const yjsConnectionStatusAtom = atom<string>("");

export const showAiMenuAtom = atom(false);

export const showLinkMenuAtom = atom(false);

/**
 * PageEditor 의 onCreate 가 에디터에 찍어 둔 «이 에디터가 물고 있는 페이지».
 *
 * 페이지를 옮기는 한 프레임 동안 pageEditorAtom 에는 아직 앞 페이지의 에디터가
 * 실려 있다(언마운트가 정리되기 전). 렌더 시점에 읽은 플래그로는 그 프레임을
 * 못 거르므로, 판정하는 쪽은 **호출 시점에** 이 값을 대조해야 한다.
 */
export function editorPageId(editor: Editor | null): string | null {
  const storage = editor?.storage as unknown as
    | Record<string, unknown>
    | undefined;
  return typeof storage?.pageId === "string" ? storage.pageId : null;
}
