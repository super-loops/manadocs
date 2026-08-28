import { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

function waitForState(checkFn: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (checkFn()) {
        clearInterval(interval);
        resolve();
      }
    }, 800);
  });
}

export const useEditorScroll = ({
  canScroll,
  initialScrollTo,
}: {
  canScroll: () => boolean;
  initialScrollTo?: string;
}) => {
  // window.location.hash 는 마운트 시점에 한 번 읽으면 되는 외부 값이다.
  // 예전엔 effect 에서 setState 로 넣어 첫 렌더가 빈 값이었고, 그 사이에 만들어진
  // handleScrollTo 는 빈 scrollTo 를 붙든 채였다. 초기값으로 바로 읽으면
  // 렌더 한 번이 줄고 그 레이스도 없어진다.
  // (initialScrollTo 는 호출부에서 마운트 시 한 번 계산돼 이후 바뀌지 않는다 —
  //  readonly-page-editor.tsx 가 유일한 전달자다.)
  const [scrollTo] = useState<string>(
    () =>
      initialScrollTo ||
      (window.location.hash ? window.location.hash.slice(1) : ""),
  );

  const handleScrollTo = useCallback(
    async (editor: Editor, _scrollTo: string | null = null, tryCount: number = 0) => {
      // 재시도를 지역 함수로 돌린다. 예전엔 useCallback 으로 memo 된 자기 자신을
      // 다시 불러서 «선언 전 접근» 이었다(react-hooks/immutability) — 그 참조는
      // scrollTo·canScroll 이 바뀌어도 옛 클로저를 붙들 수 있다.
      // 동작은 그대로다: 시도마다 canScroll 을 다시 기다리고, 못 찾으면 200ms 뒤
      // 재시도하며, 10회에서 false 로 끝난다.
      const attempt = async (
        target: string | null,
        count: number,
      ): Promise<boolean> => {
        await waitForState(() => canScroll());
        return new Promise<boolean>((resolve) => {
          const MAX_TRY_COUNT = 10;
          if (count >= MAX_TRY_COUNT) {
            resolve(false);
            return;
          }

          const targetId = target || scrollTo;
          if (!targetId) {
            resolve(false);
            return;
          }

          const dom = editor.view.dom.querySelector(`[id="${targetId}"], [data-id="${targetId}"]`);
          if (dom) {
            dom.scrollIntoView({ behavior: 'smooth', block: 'start' });
            resolve(true);
          } else {
            setTimeout(async () => {
              resolve(await attempt(targetId, count + 1));
            }, 200);
          }
        });
      };

      return attempt(_scrollTo, tryCount);
    },
    [scrollTo, canScroll],
  );

  return { scrollTo, handleScrollTo };
};
