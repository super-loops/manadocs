import { createRoot, Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { QueryClientProvider } from "@tanstack/react-query";
import type { Editor, Range } from "@tiptap/core";
import { queryClient } from "@/main";
import ReviewSelectPopupInner from "@/features/editor/components/review/review-select-popup";

/**
 * 슬래시 메뉴가 리액트 트리 밖에서 팝업을 띄운다 — 그래서 이 두 함수는
 * 컴포넌트가 아니라 명령형 마운트/언마운트다. 컴포넌트 파일과 한 곳에 있으면
 * fast refresh 가 그 파일을 갱신하지 못하므로 분리해 둔다.
 */
let mountEl: HTMLDivElement | null = null;
let mountRoot: Root | null = null;

export function openReviewSelectPopup(
  editor: Editor,
  range: Range,
  pageId: string,
) {
  if (mountRoot) closeReviewSelectPopup();
  mountEl = document.createElement("div");
  document.body.appendChild(mountEl);
  mountRoot = createRoot(mountEl);
  mountRoot.render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <ReviewSelectPopupInner
          editor={editor}
          range={range}
          pageId={pageId}
          onClose={closeReviewSelectPopup}
        />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

export function closeReviewSelectPopup() {
  mountRoot?.unmount();
  mountRoot = null;
  if (mountEl?.parentNode) mountEl.parentNode.removeChild(mountEl);
  mountEl = null;
}
