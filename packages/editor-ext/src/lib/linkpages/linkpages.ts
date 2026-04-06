import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface LinkpagesOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface LinkpagesAttributes {
  pageIds?: string[];
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    linkpages: {
      insertLinkpages: (attributes?: LinkpagesAttributes) => ReturnType;
    };
  }
}

export const Linkpages = Node.create<LinkpagesOptions>({
  name: "linkpages",

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  group: "block",
  atom: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      pageIds: {
        default: [],
        parseHTML: (element: HTMLElement) => {
          const val = element.getAttribute("data-page-ids");
          try {
            return val ? JSON.parse(val) : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attributes: LinkpagesAttributes) => {
          if (!attributes.pageIds?.length) return {};
          return {
            "data-page-ids": JSON.stringify(attributes.pageIds),
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `div[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
    ];
  },

  addCommands() {
    return {
      insertLinkpages:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },

  addNodeView() {
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },
});
