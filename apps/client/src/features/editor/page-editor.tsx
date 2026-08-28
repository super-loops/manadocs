import "@/features/editor/styles/index.css";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import {
  HocuspocusProvider,
  onStatusParameters,
  WebSocketStatus,
  HocuspocusProviderWebsocket,
  onSyncedParameters,
} from "@hocuspocus/provider";
import {
  Editor,
  EditorContent,
  EditorProvider,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import {
  collabExtensions,
  mainExtensions,
} from "@/features/editor/extensions/extensions";
import { useAtom, useSetAtom } from "jotai";
import useCollaborationUrl from "@/features/editor/hooks/use-collaboration-url";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  pageEditorAtom,
  pageEditorContentReadyAtom,
  yjsConnectionStatusAtom,
} from "@/features/editor/atoms/editor-atoms";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import TableCellMenu from "@/features/editor/components/table/table-cell-menu.tsx";
import TableMenu from "@/features/editor/components/table/table-menu.tsx";
import ImageMenu from "@/features/editor/components/image/image-menu.tsx";
import CalloutMenu from "@/features/editor/components/callout/callout-menu.tsx";
import VideoMenu from "@/features/editor/components/video/video-menu.tsx";
import PdfMenu from "@/features/editor/components/pdf/pdf-menu.tsx";
import SubpagesMenu from "@/features/editor/components/subpages/subpages-menu.tsx";
import LinkpagesMenu from "@/features/editor/components/linkpages/linkpages-menu.tsx";
import {
  handleFileDrop,
  handlePaste,
} from "@/features/editor/components/common/editor-paste-handler.tsx";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import SearchAndReplaceDialog from "@/features/editor/components/search-and-replace/search-and-replace-dialog.tsx";
import { EditorAiMenu } from "@/ee/editor/components/editor-ai-menu.tsx";
import { useDebouncedCallback, useDocumentVisibility } from "@mantine/hooks";
import { useIdle } from "@/hooks/use-idle.ts";
import { queryClient } from "@/main.tsx";
import { IPage } from "@/features/page/types/page.types.ts";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { FIVE_MINUTES } from "@/lib/constants.ts";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { jwtDecode } from "jwt-decode";
import { searchSpotlight } from "@/features/search/constants.ts";
import { useEditorScroll } from "./hooks/use-editor-scroll";
import { EditorLinkMenu } from "@/features/editor/components/link/link-menu";
import ColumnsMenu from "@/features/editor/components/columns/columns-menu.tsx";

interface PageEditorProps {
  pageId: string;
  editable: boolean;
  content: any;
  workingDocId?: string | null;
}

export default function PageEditor({
  pageId,
  editable,
  content,
  workingDocId,
}: PageEditorProps) {
  const collaborationURL = useCollaborationUrl();
  const isComponentMounted = useRef(false);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    isComponentMounted.current = true;
  }, []);

  const [currentUser] = useAtom(currentUserAtom);
  const [, setEditor] = useAtom(pageEditorAtom);
  const setPageEditorContentReady = useSetAtom(pageEditorContentReadyAtom);
  const [isLocalSynced, setIsLocalSynced] = useState(false);
  const [isRemoteSynced, setIsRemoteSynced] = useState(false);
  /**
   * ydoc 이 서버와 한 번이라도 동기화됐는가 — 「이 에디터의 본문을 믿어도 되는가」.
   *
   * 동기화 전 collab 에디터는 **빈 문서**다. 그걸 확정본과 비교하면 아무것도
   * 안 고친 페이지가 «−1» 로 잡혀 사이드바 "수정중" 에 유령이 떴다 사라진다(N-8).
   *
   * showStatic 을 쓰지 않는 이유: 그건 yjsConnectionStatus 를 타는데, 7500ms
   * 타임아웃이 그 값을 Disconnected 로 덮고 되돌리는 경로가 없다(재연결 effect 의
   * deps 에 yjsConnectionStatus 가 빠져 있다). 동기화만 느려도 판정이 영구히
   * 닫힐 수 있어, 연결 상태를 거치지 않는 신호를 쓴다.
   * 끊겼다 붙는 사이 판정이 깜빡이지 않게 한 번 켜지면 방을 옮길 때까지 유지한다.
   */
  const [ydocLoaded, setYdocLoaded] = useState(false);
  const [yjsConnectionStatus, setYjsConnectionStatus] = useAtom(
    yjsConnectionStatusAtom,
  );
  const menuContainerRef = useRef(null);
  const { data: collabQuery, refetch: refetchCollabToken } = useCollabToken();
  const { isIdle, resetIdle } = useIdle(FIVE_MINUTES, { initialState: false });
  const documentState = useDocumentVisibility();
  const { pageSlug } = useParams();
  const slugId = extractPageSlugId(pageSlug);
  const userPageEditMode =
    currentUser?.user?.settings?.preferences?.pageEditMode ?? PageEditMode.Edit;
  const canScroll = useCallback(
    () => Boolean(isComponentMounted.current && editorRef.current),
    [isComponentMounted],
  );
  const { handleScrollTo } = useEditorScroll({ canScroll });
  // Providers only created once per pageId
  const providersRef = useRef<{
    local: IndexeddbPersistence;
    remote: HocuspocusProvider;
    socket: HocuspocusProviderWebsocket;
  } | null>(null);
  const [providersReady, setProvidersReady] = useState(false);

  useEffect(() => {
    setYdocLoaded(false);
    if (!providersRef.current) {
      // 작업문서별 명시 room — 서버가 해당 작업문서 row 에 저장한다.
      // workingDocId 미지정(레거시)은 Primary 작업문서로 해석됨.
      const documentName = workingDocId
        ? `page.${pageId}.${workingDocId}`
        : `page.${pageId}`;
      const ydoc = new Y.Doc();
      const local = new IndexeddbPersistence(documentName, ydoc);
      const socket = new HocuspocusProviderWebsocket({
        url: collaborationURL,
      });
      const onLocalSyncedHandler = () => {
        setIsLocalSynced(true);
      };
      const onStatusHandler = (event: onStatusParameters) => {
        setYjsConnectionStatus(event.status);
      };
      const onSyncedHandler = (event: onSyncedParameters) => {
        setIsRemoteSynced(event.state);
      };
      const onAuthenticationFailedHandler = () => {
        const payload = jwtDecode(collabQuery?.token);
        const now = Date.now().valueOf() / 1000;
        const isTokenExpired = now >= payload.exp;
        if (isTokenExpired) {
          refetchCollabToken().then((result) => {
            if (result.data?.token) {
              socket.disconnect();
              setTimeout(() => {
                remote.configuration.token = result.data.token;
                socket.connect();
              }, 100);
            }
          });
        }
      };
      const remote = new HocuspocusProvider({
        websocketProvider: socket,
        name: documentName,
        document: ydoc,
        token: collabQuery?.token,
        onAuthenticationFailed: onAuthenticationFailedHandler,
        onStatus: onStatusHandler,
        onSynced: onSyncedHandler,
      });

      local.on("synced", onLocalSyncedHandler);
      providersRef.current = { socket, local, remote };
      setProvidersReady(true);
    } else {
      setProvidersReady(true);
    }
    // Only destroy on final unmount
    return () => {
      providersRef.current?.socket.destroy();
      providersRef.current?.remote.destroy();
      providersRef.current?.local.destroy();
      providersRef.current = null;
    };
  }, [pageId, workingDocId]);

  // Only connect/disconnect on tab/idle, not destroy
  useEffect(() => {
    if (!providersReady || !providersRef.current) return;
    const socket = providersRef.current.socket;

    if (
      isIdle &&
      documentState === "hidden" &&
      yjsConnectionStatus === WebSocketStatus.Connected
    ) {
      socket.disconnect();
      return;
    }
    if (
      documentState === "visible" &&
      yjsConnectionStatus === WebSocketStatus.Disconnected
    ) {
      resetIdle();
      socket.connect();
    }
  }, [isIdle, documentState, providersReady, resetIdle]);

  // Attach here, to make sure the connection gets properly established
  //
  // 이 호출의 «렌더마다 실행된다»가 곧 동작이다 — 탭 전환·재연결 뒤에도 매번
  // 다시 붙여 연결을 되살린다. effect 로 옮기면 실행 시점과 횟수가 둘 다 바뀌고,
  // 그러면 ydoc 동기화 시점이 흔들린다. 이 파일의 동기화 시점은
  // pageEditorContentReadyAtom 을 통해 「유령 「수정중」」과 제목 Enter 가드(H4)를
  // 좌우하므로(54aade6), 룰 하나 때문에 되돌릴 자리가 아니다.
  // eslint-disable-next-line react-hooks/refs
  providersRef.current?.remote.attach();

  // providers 는 ref 로 들고 있어야 한다 — 방(pageId·workingDocId)이 살아 있는
  // 동안 **같은 인스턴스**를 유지해야 하고, 정리에서 즉시 null 이 되어야 한다.
  // state 로 옮기면 정리 뒤에도 파괴된 provider 가 한 렌더 남아 collabExtensions
  // 에 실릴 수 있다. 여기 ref 읽기는 그 «지금 살아 있는 provider» 판정이다.
  const extensions = useMemo(() => {
    // eslint-disable-next-line react-hooks/refs
    if (!providersReady || !providersRef.current || !currentUser?.user) {
      return mainExtensions;
    }

    const remoteProvider = providersRef.current.remote;

    return [
      ...mainExtensions,
      // eslint-disable-next-line react-hooks/refs
      ...collabExtensions(remoteProvider, currentUser?.user),
    ];
  }, [providersReady, currentUser?.user]);

  const editor = useEditor(
    {
      extensions,
      editable,
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editorProps: {
        scrollThreshold: 80,
        scrollMargin: 80,
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
            if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
              const slashCommand = document.querySelector("#slash-command");
              if (slashCommand) {
                return true;
              }
            }
            if (
              [
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
                "Enter",
              ].includes(event.key)
            ) {
              const emojiCommand = document.querySelector("#emoji-command");
              if (emojiCommand) {
                return true;
              }
            }
          },
        },
        handlePaste: (_view, event) => {
          if (!editorRef.current) return false;

          return handlePaste(
            editorRef.current,
            event,
            pageId,
            currentUser?.user.id,
          );
        },
        handleDrop: (_view, event, _slice, moved) => {
          if (!editorRef.current) return false;

          return handleFileDrop(editorRef.current, event, moved, pageId);
        },
      },
      onCreate({ editor }) {
        if (editor) {
          // 신원 스탬프를 **먼저** 찍고 전역에 싣는다 — 소비자가 editorPageId()
          // 로 대조하므로 스탬프 없는 상태가 노출되면 안 된다.
          // @ts-ignore
          editor.storage.pageId = pageId;
          editorRef.current = editor;
          setEditor(editor);
          handleScrollTo(editor);
        }
      },
      onUpdate({ editor }) {
        if (editor.isEmpty) return;
        const editorJson = editor.getJSON();
        //update local page cache to reduce flickers
        debouncedUpdateContent(editorJson);
      },
    },
    [pageId, editable, extensions],
  );

  const editorIsEditable = useEditorState({
    editor,
    selector: (ctx) => {
      return ctx.editor?.isEditable ?? false;
    },
  });

  const debouncedUpdateContent = useDebouncedCallback((newContent: any) => {
    const pageData = queryClient.getQueryData<IPage>(["pages", slugId]);

    if (pageData) {
      queryClient.setQueryData(["pages", slugId], {
        ...pageData,
        content: newContent,
        updatedAt: new Date(),
      });
    }
  }, 3000);

  const isSynced = isLocalSynced && isRemoteSynced;

  useEffect(() => {
    if (isRemoteSynced) setYdocLoaded(true);
  }, [isRemoteSynced]);

  useEffect(() => {
    setPageEditorContentReady(ydocLoaded);
    return () => setPageEditorContentReady(false);
  }, [ydocLoaded, setPageEditorContentReady]);

  /**
   * 언마운트하면 atom 을 비운다 — pageEditorAtom 은 「**지금 열려 있는 페이지**의
   * 에디터」여야 한다.
   *
   * 비우지 않으면 PageEditor 를 마운트하지 않는 곳(읽기전용 페이지·404·로딩·
   * 페이지 아닌 라우트)에 도착했을 때 앞 페이지의 죽은 에디터가 그대로 눌러앉는다.
   * tiptap 은 destroy 후에도 `state`·`storage` 를 살려두므로 `getHTML()` 같은
   * 읽기가 **조용히 앞 페이지 내용을 돌려주고**(마크다운 복사가 남의 문서를
   * 퍼갔다), `view` 는 던지는 Proxy 라 목차가 DOM 을 만지면 터진다.
   *
   * 소비자마다 가드를 복붙하는 대신 atom 이 이름값을 하게 두면, 이미 다들 갖고
   * 있는 `if (!editor)` 가드가 그대로 옳아진다. 특히 목차는
   * `pageEditor ?? readOnlyEditor` 라 null 이어야 폴백이 살아난다.
   */
  useEffect(() => {
    // 「내가 실은 그 에디터일 때만」 비운다 — tiptap 의 create 는 setTimeout(0),
    // React 의 정리는 별도 큐라 순서가 보장되지 않는다. 무조건 비우면 다음
    // 페이지가 이미 실어 둔 에디터를 덮어 atom 이 영구 null 이 될 수 있다.
    return () =>
      setEditor((current) => (current === editorRef.current ? null : current));
  }, [setEditor]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (yjsConnectionStatus === WebSocketStatus.Connecting || !isSynced) {
        setYjsConnectionStatus(WebSocketStatus.Disconnected);
      }
    }, 7500);

    return () => clearTimeout(timeout);
  }, [yjsConnectionStatus, isSynced]);
  useEffect(() => {
    // Only honor user default page edit mode preference and permissions
    if (editor) {
      if (userPageEditMode && editable) {
        if (userPageEditMode === PageEditMode.Edit) {
          editor.setEditable(true);
        } else if (userPageEditMode === PageEditMode.Read) {
          editor.setEditable(false);
        }
      } else {
        editor.setEditable(false);
      }
    }
  }, [userPageEditMode, editor, editable]);

  const hasConnectedOnceRef = useRef(false);
  const [showStatic, setShowStatic] = useState(true);

  useEffect(() => {
    if (
      !hasConnectedOnceRef.current &&
      yjsConnectionStatus === WebSocketStatus.Connected &&
      isSynced
    ) {
      hasConnectedOnceRef.current = true;
      setShowStatic(false);
    }
  }, [yjsConnectionStatus, isSynced]);

  if (showStatic) {
    return (
      <EditorProvider
        editable={false}
        immediatelyRender={true}
        extensions={mainExtensions}
        content={content}
      />
    );
  }

  return (
    <div className="editor-container" style={{ position: "relative" }}>
      <div ref={menuContainerRef}>
        <EditorContent editor={editor} />

        {editor && (
          <SearchAndReplaceDialog editor={editor} editable={editable} />
        )}

        {editor && editorIsEditable && (
          <div>
            <EditorAiMenu editor={editor} />
            <EditorLinkMenu editor={editor} />
            <EditorBubbleMenu editor={editor} />
            <TableMenu editor={editor} />
            <TableCellMenu editor={editor} appendTo={menuContainerRef} />
            <ImageMenu editor={editor} />
            <VideoMenu editor={editor} />
            <PdfMenu editor={editor} />
            <CalloutMenu editor={editor} />
            <SubpagesMenu editor={editor} />
            <LinkpagesMenu editor={editor} />
            <ColumnsMenu editor={editor} />
          </div>
        )}
      </div>
      <div
        onClick={() => editor.commands.focus("end")}
        style={{ paddingBottom: "20vh" }}
      ></div>
    </div>
  );
}
