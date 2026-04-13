import { Node, mergeAttributes } from '@tiptap/core';

export type ReviewAnchorStatus = 'open' | 'progress' | 'resolved';

export interface ReviewAnchorAttributes {
  anchorId: string;
  reviewId: string;
  sequenceId: number;
  reviewSequenceId: number;
  status: ReviewAnchorStatus;
}

export interface ReviewAnchorOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    reviewAnchor: {
      insertReviewAnchor: (attributes: ReviewAnchorAttributes) => ReturnType;
    };
  }
}

export const ReviewAnchor = Node.create<ReviewAnchorOptions>({
  name: 'reviewAnchor',
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

  addAttributes() {
    return {
      anchorId: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-anchor-id') || '',
        renderHTML: (attributes) => ({
          'data-anchor-id': attributes.anchorId,
        }),
      },
      reviewId: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-review-id') || '',
        renderHTML: (attributes) => ({
          'data-review-id': attributes.reviewId,
        }),
      },
      sequenceId: {
        default: 0,
        parseHTML: (element: HTMLElement) =>
          Number(element.getAttribute('data-sequence-id') || 0),
        renderHTML: (attributes) => ({
          'data-sequence-id': String(attributes.sequenceId),
        }),
      },
      reviewSequenceId: {
        default: 0,
        parseHTML: (element: HTMLElement) =>
          Number(element.getAttribute('data-review-sequence-id') || 0),
        renderHTML: (attributes) => ({
          'data-review-sequence-id': String(attributes.reviewSequenceId),
        }),
      },
      status: {
        default: 'open',
        parseHTML: (element: HTMLElement) =>
          (element.getAttribute('data-status') || 'open') as ReviewAnchorStatus,
        renderHTML: (attributes) => ({
          'data-status': attributes.status,
        }),
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
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-type': this.name }),
      '',
    ];
  },

  addCommands() {
    return {
      insertReviewAnchor:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },
});
