import "@/features/editor/styles/index.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";
import { Heading } from "@tiptap/extension-heading";
import { Text } from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useAtomValue } from "jotai";
import {
  editorPageId,
  pageEditorAtom,
  pageEditorContentReadyAtom,
  titleEditorAtom,
} from "@/features/editor/atoms/editor-atoms";
import {
  updatePageData,
  useUpdateTitlePageMutation,
} from "@/features/page/queries/page-query";
import { useDebouncedCallback, getHotkeyHandler } from "@mantine/hooks";
import { useAtom } from "jotai";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { History } from "@tiptap/extension-history";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import EmojiCommand from "@/features/editor/extensions/emoji-command.ts";
import { UpdateEvent } from "@/features/websocket/types";
import localEmitter from "@/lib/local-emitter.ts";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { searchSpotlight } from "@/features/search/constants.ts";
import { notifications } from "@mantine/notifications";

export interface TitleEditorProps {
  pageId: string;
  slugId: string;
  title: string;
  spaceSlug: string;
  editable: boolean;
}

export function TitleEditor({
  pageId,
  slugId,
  title,
  spaceSlug,
  editable,
}: TitleEditorProps) {
  const { t } = useTranslation();
  const { mutateAsync: updateTitlePageMutationAsync } =
    useUpdateTitlePageMutation();
  const pageEditor = useAtomValue(pageEditorAtom);
  const pageEditorReady = useAtomValue(pageEditorContentReadyAtom);
  const [, setTitleEditor] = useAtom(titleEditorAtom);
  const emit = useQueryEmit();
  const navigate = useNavigate();
  const [activePageId, setActivePageId] = useState(pageId);
  /** 이 인스턴스가 전역에 실은 제목 에디터 — 정리할 때 신원 대조용 */
  const createdTitleEditorRef = useRef<Editor | null>(null);
  const [currentUser] = useAtom(currentUserAtom);
  const userPageEditMode =
    currentUser?.user?.settings?.preferences?.pageEditMode ?? PageEditMode.Edit;

  const titleEditor = useEditor({
    extensions: [
      Document.extend({
        content: "heading",
      }),
      Heading.configure({
        levels: [1],
      }),
      Text,
      Placeholder.configure({
        placeholder: t("untitled"),
        showOnlyWhenEditable: false,
      }),
      History.configure({
        depth: 20,
      }),
      EmojiCommand,
    ],
    onCreate({ editor }) {
      if (editor) {
        createdTitleEditorRef.current = editor;
        setTitleEditor(editor);
        setActivePageId(pageId);
      }
    },
    onUpdate({ editor }) {
      debounceUpdate();
    },
    editable: editable,
    content: title,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      handleDOMEvents: {
        keydown: (_view, event) => {
          if ((event.ctrlKey || event.metaKey) && event.code === "KeyS") {
            event.preventDefault();
            return true;
          }
          if ((event.ctrlKey || event.metaKey) && event.code === "KeyK") {
            searchSpotlight.open();
            return true;
          }
        },
      },
    },
  });

  useEffect(() => {
    const anchorId = window.location.hash
      ? window.location.hash.substring(1)
      : undefined;
    const pageSlug = buildPageUrl(spaceSlug, slugId, title, anchorId);
    navigate(pageSlug, { replace: true });
  }, [title]);

  const saveTitle = useCallback(() => {
    if (!titleEditor || activePageId !== pageId) return;

    if (
      titleEditor.getText() === title ||
      (titleEditor.getText() === "" && title === null)
    ) {
      return;
    }

    updateTitlePageMutationAsync({
      pageId: pageId,
      title: titleEditor.getText(),
    }).then((page) => {
      const event: UpdateEvent = {
        operation: "updateOne",
        spaceId: page.spaceId,
        entity: ["pages"],
        id: page.id,
        payload: {
          title: page.title,
          slugId: page.slugId,
          parentPageId: page.parentPageId,
          icon: page.icon,
        },
      };

      if (page.title !== titleEditor.getText()) return;

      updatePageData(page);

      localEmitter.emit("message", event);
      emit(event);
    });
  }, [pageId, title, titleEditor]);

  const debounceUpdate = useDebouncedCallback(saveTitle, 500);

  useEffect(() => {
    if (!titleEditor) return;
    // skip while user is actively editing — incoming syncs must not clobber typed input
    if (titleEditor.isFocused) return;
    if (title !== titleEditor.getText()) {
      titleEditor.commands.setContent(title);
    }
  }, [pageId, title, titleEditor]);

  // 언마운트하면 atom 을 비운다 — 「지금 열려 있는 페이지의 제목 에디터」여야 한다
  useEffect(() => {
    // 내가 실은 에디터일 때만 비운다 — page-editor.tsx 의 같은 주석 참고
    return () =>
      setTitleEditor((current) =>
        current === createdTitleEditorRef.current ? null : current,
      );
  }, [setTitleEditor]);

  useEffect(() => {
    // 제목이 **비어 있을 때만** 커서를 제목으로 보낸다.
    //  - 새로 만든 페이지: 바로 제목을 칠 수 있게 커서가 간다.
    //  - 제목이 있는 문서를 열 때: 커서를 건드리지 않는다. 예전엔 이동할 때마다
    //    무조건 발동해서, 읽으려고 연 문서에서도 포커스를 뺏어갔다(N-8 (2)).
    // 공백만 있는 제목도 빈 것으로 본다.
    if (title?.trim()) return;

    // 타이머를 안 걷으면 이미 떠난 페이지의 포커스 요청이 뒤늦게 터진다 —
    // 페이지를 연달아 넘기면 방금 연 페이지에서 커서가 제목으로 튄다.
    const timer = setTimeout(() => {
      // guard against Cannot access view['hasFocus'] error
      if (!titleEditor?.isInitialized) return;
      titleEditor?.commands?.focus("end");
    }, 300);
    return () => clearTimeout(timer);
  }, [titleEditor, title]);

  useEffect(() => {
    return () => {
      // force-save title on navigation
      saveTitle();
    };
  }, [pageId]);

  useEffect(() => {
    if (titleEditor) {
      if (userPageEditMode && editable) {
        if (userPageEditMode === PageEditMode.Edit) {
          titleEditor.setEditable(true);
        } else if (userPageEditMode === PageEditMode.Read) {
          titleEditor.setEditable(false);
        }
      } else {
        titleEditor.setEditable(false);
      }
    }
  }, [userPageEditMode, titleEditor, editable]);

  const openSearchDialog = () => {
    const event = new CustomEvent("openFindDialogFromEditor", {});
    document.dispatchEvent(event);
  };

  function handleTitleKeyDown(event: any) {
    if (!titleEditor || !pageEditor || event.shiftKey) return;
    // 죽었거나 다른 페이지의 본문 에디터면 아무것도 하지 않는다.
    // 렌더 시점 스냅샷이 아니라 **호출 시점에** 에디터 객체를 대조한다 —
    // editor-atoms.ts 의 editorPageId() 주석에 적힌 규칙.
    if (pageEditor.isDestroyed || editorPageId(pageEditor) !== pageId) return;

    // Prevent focus shift when IME composition is active
    // `keyCode === 229` is added to support Safari where `isComposing` may not be reliable
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
      return;

    const { key } = event;
    const { $head } = titleEditor.state.selection;

    if (key === "Enter") {
      event.preventDefault();

      // 본문이 아직 안 실렸으면 **아무것도 건드리지 않는다.**
      // 동기화 전 collab 에디터는 빈 문서다. 그대로 진행하면 아래에서 제목
      // 뒷부분을 지운 뒤 그 문단을 빈 ydoc 0번에 넣는데, 뒤늦게 도착한 진짜
      // 본문과 Yjs 가 병합하면서 **제목 글자는 사라지고 본문 맨 위에 유령
      // 문단이 박힌다.** 지우기 전에 막아야 데이터가 안 없어진다.
      //
      // 여기서 Enter 를 «나중에 이어서» 처리하는 방안도 검토했지만, 몇 초 뒤에
      // 문서가 저 혼자 바뀌는 편이 더 나쁘고 중간에 페이지를 떠나면 그대로
      // 유실된다. 삼키되 왜 안 됐는지는 말해 준다.
      if (!pageEditorReady) {
        notifications.show({
          message: t("본문을 불러오는 중입니다. 잠시 후 다시 시도해 주세요."),
        });
        return;
      }

      const { $from } = titleEditor.state.selection;
      const titleText = titleEditor.getText();

      // Get the text offset within the heading node (not document position)
      const textOffset = $from.parentOffset;

      const textAfterCursor = titleText.slice(textOffset);

      // Delete text after cursor from title (this will be in undo history)
      const endPos = titleEditor.state.doc.content.size;
      if (textAfterCursor) {
        titleEditor.commands.deleteRange({ from: $from.pos, to: endPos });
      }

      // Don't add to history so undo in page editor won't remove this split
      pageEditor
        .chain()
        .command(({ tr }) => {
          tr.setMeta("addToHistory", false);
          return true;
        })
        .insertContentAt(0, {
          type: "paragraph",
          content: textAfterCursor
            ? [{ type: "text", text: textAfterCursor }]
            : undefined,
        })
        .focus("start")
        .run();
      return;
    }

    const shouldFocusEditor =
      key === "ArrowDown" || (key === "ArrowRight" && !$head.nodeAfter);

    if (shouldFocusEditor) {
      pageEditor.commands.focus("start");
    }
  }

  return (
    <div className="page-title">
      <EditorContent
        editor={titleEditor}
        onKeyDown={(event) => {
          // First handle the search hotkey
          getHotkeyHandler([["mod+F", openSearchDialog]])(event);

          // Then handle other key events
          handleTitleKeyDown(event);
        }}
      />
    </div>
  );
}
