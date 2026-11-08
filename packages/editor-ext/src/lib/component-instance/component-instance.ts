import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { sanitizeUrl } from "../utils";

/**
 * 스페이스 컴포넌트의 인스턴스.
 *
 * 노드는 컴포넌트의 «사본»을 든다 — 고정된 리비전과 그 파일(src). 그래서 확정
 * 버전·공유 화면·내보내기는 컴포넌트를 다시 조회하지 않고도 그 시점의 모습을
 * 그린다. revision 0 은 «에셋 없음» 자리다.
 */
export interface ComponentInstanceAttributes {
  componentId: string | null;
  slug: string | null;
  kind: "image" | "file" | string;
  description: string | null;
  revision: number;
  src: string | null;
  attachmentId: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  width: string | number | null;
  align: string;
}

export interface ComponentInstanceOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    componentInstance: {
      insertComponentInstance: (
        attributes: Partial<ComponentInstanceAttributes>,
      ) => ReturnType;
    };
  }
}

const dataAttr = (name: string, key: string, numeric = false) => ({
  default: null,
  parseHTML: (element: HTMLElement) => {
    const raw = element.getAttribute(`data-${name}`);
    if (raw === null || raw === "") return null;
    if (!numeric) return raw;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  },
  renderHTML: (attributes: Record<string, any>) =>
    attributes[key] === null || attributes[key] === undefined
      ? {}
      : { [`data-${name}`]: attributes[key] },
});

export const ComponentInstance = Node.create<ComponentInstanceOptions>({
  name: "componentInstance",
  inline: false,
  group: "block",
  isolating: true,
  atom: true,
  defining: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  addAttributes() {
    return {
      componentId: dataAttr("component-id", "componentId"),
      slug: dataAttr("slug", "slug"),
      kind: {
        default: "image",
        parseHTML: (element) => element.getAttribute("data-kind") || "image",
        renderHTML: (attributes) => ({ "data-kind": attributes.kind }),
      },
      description: dataAttr("description", "description"),
      revision: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute("data-revision") ?? 0) || 0,
        renderHTML: (attributes) => ({ "data-revision": attributes.revision ?? 0 }),
      },
      src: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-src");
          return raw ? sanitizeUrl(raw) || null : null;
        },
        renderHTML: (attributes) =>
          attributes.src ? { "data-src": sanitizeUrl(attributes.src) } : {},
      },
      attachmentId: dataAttr("attachment-id", "attachmentId"),
      fileName: dataAttr("file-name", "fileName"),
      fileSize: dataAttr("file-size", "fileSize", true),
      mimeType: dataAttr("mime-type", "mimeType"),
      width: dataAttr("width", "width"),
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") || "center",
        renderHTML: (attributes) => ({ "data-align": attributes.align }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-type="${this.name}"]` }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs = mergeAttributes(
      { "data-type": this.name },
      this.options.HTMLAttributes,
      HTMLAttributes,
    );
    const src = node.attrs.src ? sanitizeUrl(node.attrs.src) : "";
    const label = node.attrs.slug ? `◇ ${node.attrs.slug}` : "◇ component";

    if (src && node.attrs.kind === "image") {
      return [
        "div",
        attrs,
        ["img", { src, alt: node.attrs.description || node.attrs.slug || "" }],
      ];
    }
    if (src) {
      return [
        "div",
        attrs,
        ["a", { href: src, target: "blank" }, node.attrs.fileName || label],
      ];
    }
    return [
      "div",
      attrs,
      ["p", {}, `${label} — ${node.attrs.description || "에셋 없음"}`],
    ];
  },

  addCommands() {
    return {
      insertComponentInstance:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  addNodeView() {
    if (!this.options.view) return null;
    // 첨부 노드와 같은 이유로 즉시 렌더
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view, {
      // 파일을 인스턴스 위에 놓으면 에디터의 일반 업로드(새 이미지 노드)가 아니라
      // 인스턴스가 받는다. 그 밖의 이벤트는 기본 NodeView 규칙을 따른다.
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement | null;
        const isDrag = event.type.startsWith("drag") || event.type === "drop";
        if (isDrag) {
          const types = (event as DragEvent).dataTransfer?.types;
          const hasFiles = !!types && Array.from(types).includes("Files");
          return hasFiles && !!target?.closest?.("[data-component-dropzone]");
        }
        if (
          target?.closest?.("button, a, input, [role='menu'], [role='dialog']")
        ) {
          return true;
        }
        return false;
      },
    });
  },
});
