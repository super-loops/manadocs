import "@/features/editor/styles/index.css";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { EditorProvider } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { Document } from "@tiptap/extension-document";
import { Heading, UniqueID } from "@manadocs/editor-ext";
import { Text } from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useAtom } from "jotai";
import { readOnlyEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { useEditorScroll } from "./hooks/use-editor-scroll";
import i18n from "@/i18n.ts";

interface PageEditorProps {
  title: string;
  content: any;
  pageId?: string;
  /**
   * 이 에디터를 전역 `readOnlyEditorAtom` 에 실을지. 기본 true — 「페이지 본문의
   * 읽기 에디터」인 경우다.
   *
   * 모달처럼 **페이지 본문이 아닌** 읽기 에디터는 false 로 둔다. 예전엔 버전
   * 미리보기·휴지통 미리보기 모달이 전역 atom 을 덮어쓰고 닫아도 돌려주지
   * 않아서, 모달을 한 번 열면 그 뒤로 페이지의 목차·리뷰 앵커가 **죽은 미리보기
   * 에디터**를 페이지 것인 양 물고 있었다.
   */
  publishAsPageEditor?: boolean;
  /** 전역에 싣지 않고 지역에서 에디터를 받고 싶을 때 (모달 등) */
  onEditorReady?: (editor: Editor) => void;
}

export default function ReadonlyPageEditor({
  title,
  content,
  pageId,
  publishAsPageEditor = true,
  onEditorReady,
}: PageEditorProps) {
  const [, setReadOnlyEditor] = useAtom(readOnlyEditorAtom);
  const isComponentMounted = useRef(false);
  const editorCreated = useRef(false);
  /** 이 인스턴스가 전역에 실은 에디터 — 정리할 때 신원 대조용 */
  const createdEditorRef = useRef<Editor | null>(null);

  const canScroll = useCallback(
    () => isComponentMounted.current && editorCreated.current,
    [isComponentMounted, editorCreated],
  );
  const initialScrollTo = window.location.hash
    ? window.location.hash.slice(1)
    : "";
  const { handleScrollTo } = useEditorScroll({ canScroll, initialScrollTo });

  useEffect(() => {
    isComponentMounted.current = true;
  }, []);

  // 언마운트하면 전역 atom 을 비운다 — 「지금 열려 있는 페이지의 읽기 에디터」가
  // 아닌 죽은 에디터가 남으면 목차·리뷰 앵커가 그걸 물고 있는다.
  useEffect(() => {
    if (!publishAsPageEditor) return;
    // 내가 실은 에디터일 때만 비운다 — page-editor.tsx 의 같은 주석 참고.
    // 이쪽은 useEditor deps 가 [] 라 재생성으로 자가치유되지 않아 더 위험하다.
    return () =>
      setReadOnlyEditor((current) =>
        current === createdEditorRef.current ? null : current,
      );
  }, [publishAsPageEditor, setReadOnlyEditor]);

  const extensions = useMemo(() => {
    const filteredExtensions = mainExtensions.filter(
      (ext) => ext.name !== "uniqueID",
    );

    return [
      ...filteredExtensions,
      UniqueID.configure({
        types: ["heading", "paragraph"],
        updateDocument: false,
      }),
    ];
  }, []);

  const titleExtensions = [
    Document.extend({
      content: "heading",
    }),
    Heading,
    Text,
    Placeholder.configure({
      placeholder: i18n.t("untitled"),
      showOnlyWhenEditable: false,
    }),
  ];

  return (
    <>
      <div className="page-title">
        <EditorProvider
          editable={false}
          immediatelyRender={true}
          extensions={titleExtensions}
          content={title}
        ></EditorProvider>
      </div>

      <EditorProvider
        editable={false}
        immediatelyRender={true}
        extensions={extensions}
        content={content}
        onCreate={({ editor }) => {
          if (editor) {
            if (pageId) {
              // @ts-ignore
              editor.storage.pageId = pageId;
            }
            if (publishAsPageEditor) {
              createdEditorRef.current = editor;
              setReadOnlyEditor(editor);
            }
            onEditorReady?.(editor);

            handleScrollTo(editor);
            editorCreated.current = true;
          }
        }}
      ></EditorProvider>
      <div style={{ paddingBottom: "20vh" }}></div>
    </>
  );
}
