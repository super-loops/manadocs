import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

export type StatusStorage = {
  autoOpen: boolean;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    status: {
      setStatus: (attributes?: { text?: string; color?: string }) => ReturnType;
    };
  }

  interface Storage {
    status: StatusStorage;
  }
}

export type StatusColor =
  | 'gray'
  | 'purple'
  | 'blue'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'green'
  | 'black';

export const STATUS_PRESETS: Record<StatusColor, string> = {
  gray: '대기',
  purple: '준비',
  blue: '승인됨',
  yellow: '재검토',
  orange: '처리중',
  red: '정지',
  green: '완료',
  black: '폐기',
};

export interface StatusOption {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export const Status = Node.create<StatusOption, StatusStorage>({
  name: 'status',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  addStorage() {
    return {
      autoOpen: false,
    };
  },

  addAttributes() {
    return {
      text: {
        default: '',
        parseHTML: (element: HTMLElement) => element.textContent || '',
      },
      color: {
        default: 'gray',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-color') || 'gray',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const color = HTMLAttributes.color as StatusColor;
    const label = STATUS_PRESETS[color] ?? HTMLAttributes.text ?? '';
    return [
      'span',
      {
        'data-type': this.name,
        'data-color': color,
      },
      label,
    ];
  },

  addNodeView() {
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },

  addCommands() {
    return {
      setStatus:
        (attributes) =>
        ({ commands }) => {
          this.storage.autoOpen = true;
          const color = (attributes?.color || 'gray') as StatusColor;
          const text = STATUS_PRESETS[color] ?? attributes?.text ?? '';
          return commands.insertContent({
            type: this.name,
            attrs: { text, color },
          });
        },
    };
  },
});
