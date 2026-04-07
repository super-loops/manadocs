import { Injectable } from '@nestjs/common';
import { McpTool } from '../mcp.types';

type NodeDoc = {
  category: 'block' | 'inline' | 'mark' | 'synthetic';
  summary: string;
  attrs?: Record<string, string>;
  children?: string;
  example: any;
};

const NODE_DOCS: Record<string, NodeDoc> = {
  doc: {
    category: 'block',
    summary: 'Root document node. The content of a page is always a doc.',
    children: 'block nodes',
    example: { type: 'doc', content: [{ type: 'paragraph' }] },
  },
  paragraph: {
    category: 'block',
    summary: 'A text paragraph. Most common block type.',
    attrs: {
      textAlign: 'left | center | right | justify (optional)',
      id: 'auto-assigned unique id (do not set manually)',
    },
    children: 'inline (text, mention, mathInline, hardBreak, status)',
    example: {
      type: 'paragraph',
      content: [{ type: 'text', text: 'hello world' }],
    },
  },
  heading: {
    category: 'block',
    summary: 'Section heading, level 1-6.',
    attrs: {
      level: '1 | 2 | 3 | 4 | 5 | 6',
      textAlign: 'left | center | right (optional)',
      id: 'auto-assigned unique id (do not set manually)',
    },
    children: 'inline',
    example: {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Section' }],
    },
  },
  bulletList: {
    category: 'block',
    summary: 'Unordered list.',
    children: 'listItem',
    example: {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'item' }] },
          ],
        },
      ],
    },
  },
  orderedList: {
    category: 'block',
    summary: 'Numbered list.',
    attrs: { start: 'starting number (default 1)' },
    children: 'listItem',
    example: {
      type: 'orderedList',
      attrs: { start: 1 },
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
          ],
        },
      ],
    },
  },
  listItem: {
    category: 'block',
    summary: 'Item inside bulletList/orderedList.',
    children: 'paragraph + optional nested list',
    example: {
      type: 'listItem',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'item' }] },
      ],
    },
  },
  taskList: {
    category: 'block',
    summary: 'Checklist of taskItem nodes.',
    children: 'taskItem',
    example: {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'todo' }] },
          ],
        },
      ],
    },
  },
  taskItem: {
    category: 'block',
    summary: 'Single task with checkbox.',
    attrs: { checked: 'true | false' },
    children: 'paragraph + optional nested taskList',
    example: {
      type: 'taskItem',
      attrs: { checked: true },
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'done' }] },
      ],
    },
  },
  blockquote: {
    category: 'block',
    summary: 'Quoted block.',
    children: 'block nodes',
    example: {
      type: 'blockquote',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'quoted' }] },
      ],
    },
  },
  codeBlock: {
    category: 'block',
    summary: 'Fenced code block with syntax highlighting.',
    attrs: { language: 'string e.g. "typescript", "python"' },
    children: 'plain text only (no marks)',
    example: {
      type: 'codeBlock',
      attrs: { language: 'typescript' },
      content: [{ type: 'text', text: 'const x = 1;' }],
    },
  },
  horizontalRule: {
    category: 'block',
    summary: 'Thematic break (hr).',
    example: { type: 'horizontalRule' },
  },
  callout: {
    category: 'block',
    summary: 'Admonition/callout box.',
    attrs: { type: 'info | warning | success | danger' },
    children: 'block nodes',
    example: {
      type: 'callout',
      attrs: { type: 'warning' },
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '주의' }] },
      ],
    },
  },
  details: {
    category: 'block',
    summary: 'Collapsible disclosure section.',
    attrs: { open: 'true | false (optional)' },
    children: 'detailsSummary then detailsContent',
    example: {
      type: 'details',
      attrs: { open: false },
      content: [
        {
          type: 'detailsSummary',
          content: [{ type: 'text', text: 'Click to expand' }],
        },
        {
          type: 'detailsContent',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'hidden' }] },
          ],
        },
      ],
    },
  },
  detailsSummary: {
    category: 'block',
    summary: 'Header row of a details block.',
    children: 'inline',
    example: {
      type: 'detailsSummary',
      content: [{ type: 'text', text: 'summary' }],
    },
  },
  detailsContent: {
    category: 'block',
    summary: 'Body of a details block.',
    children: 'block nodes',
    example: {
      type: 'detailsContent',
      content: [{ type: 'paragraph' }],
    },
  },
  table: {
    category: 'block',
    summary: 'Data table.',
    children: 'tableRow',
    example: {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'H' }] },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'c' }] },
              ],
            },
          ],
        },
      ],
    },
  },
  tableRow: {
    category: 'block',
    summary: 'Row inside a table.',
    children: 'tableHeader | tableCell',
    example: { type: 'tableRow', content: [] },
  },
  tableHeader: {
    category: 'block',
    summary: 'Header cell.',
    attrs: { colspan: 'number (default 1)', rowspan: 'number (default 1)' },
    children: 'block nodes',
    example: {
      type: 'tableHeader',
      content: [{ type: 'paragraph' }],
    },
  },
  tableCell: {
    category: 'block',
    summary: 'Body cell.',
    attrs: { colspan: 'number (default 1)', rowspan: 'number (default 1)' },
    children: 'block nodes',
    example: {
      type: 'tableCell',
      content: [{ type: 'paragraph' }],
    },
  },
  columns: {
    category: 'block',
    summary: 'Multi-column layout container.',
    children: 'column',
    example: {
      type: 'columns',
      content: [
        { type: 'column', content: [{ type: 'paragraph' }] },
        { type: 'column', content: [{ type: 'paragraph' }] },
      ],
    },
  },
  column: {
    category: 'block',
    summary: 'Single column inside a columns block.',
    children: 'block nodes',
    example: { type: 'column', content: [{ type: 'paragraph' }] },
  },
  image: {
    category: 'block',
    summary: 'Embedded image. Usually uploaded via UI; reference existing src.',
    attrs: {
      src: 'url',
      alt: 'string',
      title: 'string',
      width: 'number | string',
      align: 'left | center | right',
    },
    example: {
      type: 'image',
      attrs: { src: '/files/abc.png', alt: 'diagram', width: 600 },
    },
  },
  video: {
    category: 'block',
    summary: 'Embedded video file.',
    attrs: { src: 'url', width: 'number', align: 'left | center | right' },
    example: { type: 'video', attrs: { src: '/files/clip.mp4' } },
  },
  audio: {
    category: 'block',
    summary: 'Embedded audio file.',
    attrs: { src: 'url' },
    example: { type: 'audio', attrs: { src: '/files/voice.mp3' } },
  },
  pdf: {
    category: 'block',
    summary: 'Embedded PDF viewer.',
    attrs: { src: 'url' },
    example: { type: 'pdf', attrs: { src: '/files/spec.pdf' } },
  },
  attachment: {
    category: 'block',
    summary: 'Generic file attachment.',
    attrs: { src: 'url', name: 'string', size: 'number', mime: 'string' },
    example: {
      type: 'attachment',
      attrs: { src: '/files/doc.zip', name: 'doc.zip', size: 1024 },
    },
  },
  embed: {
    category: 'block',
    summary: 'External embed (iframe).',
    attrs: { src: 'url', provider: 'string (e.g. figma, loom)' },
    example: {
      type: 'embed',
      attrs: { src: 'https://www.figma.com/file/...', provider: 'figma' },
    },
  },
  youtube: {
    category: 'block',
    summary: 'YouTube video embed.',
    attrs: { src: 'youtube url', width: 'number', height: 'number' },
    example: {
      type: 'youtube',
      attrs: { src: 'https://youtu.be/xxx', width: 640, height: 360 },
    },
  },
  subpages: {
    category: 'block',
    summary: 'Dynamic list of child pages.',
    example: { type: 'subpages' },
  },
  mathBlock: {
    category: 'block',
    summary: 'Display-mode LaTeX math block.',
    attrs: { latex: 'LaTeX source' },
    example: { type: 'mathBlock', attrs: { latex: 'E = mc^2' } },
  },
  text: {
    category: 'inline',
    summary: 'Text node. Can carry marks.',
    attrs: { text: 'string (required)' },
    example: { type: 'text', text: 'hello' },
  },
  hardBreak: {
    category: 'inline',
    summary: 'Line break within a block (shift+enter).',
    example: { type: 'hardBreak' },
  },
  mention: {
    category: 'inline',
    summary: '@-mention of a user or page.',
    attrs: {
      id: 'user/page id',
      label: 'display text',
      entityType: 'user | page',
    },
    example: {
      type: 'mention',
      attrs: { id: 'user-uuid', label: '@alice', entityType: 'user' },
    },
  },
  mathInline: {
    category: 'inline',
    summary: 'Inline LaTeX math.',
    attrs: { latex: 'LaTeX source' },
    example: { type: 'mathInline', attrs: { latex: 'a^2 + b^2' } },
  },
  status: {
    category: 'inline',
    summary:
      'Status badge (preset). The color determines the label automatically: gray=대기, purple=준비, blue=승인됨, yellow=재검토, orange=처리중, red=정지, green=완료, black=폐기. Only set color; text is derived.',
    attrs: {
      color:
        'gray | purple | blue | yellow | orange | red | green | black',
    },
    example: {
      type: 'status',
      attrs: { color: 'blue' },
    },
  },
  // marks
  bold: {
    category: 'mark',
    summary: 'Bold text.',
    example: {
      type: 'text',
      text: 'bold',
      marks: [{ type: 'bold' }],
    },
  },
  italic: {
    category: 'mark',
    summary: 'Italic text.',
    example: {
      type: 'text',
      text: 'italic',
      marks: [{ type: 'italic' }],
    },
  },
  strike: {
    category: 'mark',
    summary: 'Strikethrough text.',
    example: {
      type: 'text',
      text: 'gone',
      marks: [{ type: 'strike' }],
    },
  },
  code: {
    category: 'mark',
    summary: 'Inline code.',
    example: {
      type: 'text',
      text: 'const',
      marks: [{ type: 'code' }],
    },
  },
  underline: {
    category: 'mark',
    summary: 'Underlined text.',
    example: {
      type: 'text',
      text: 'under',
      marks: [{ type: 'underline' }],
    },
  },
  link: {
    category: 'mark',
    summary: 'Hyperlink mark.',
    attrs: { href: 'url', target: '_blank (optional)' },
    example: {
      type: 'text',
      text: 'link',
      marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
    },
  },
  superscript: {
    category: 'mark',
    summary: 'Superscript.',
    example: {
      type: 'text',
      text: '2',
      marks: [{ type: 'superscript' }],
    },
  },
  subscript: {
    category: 'mark',
    summary: 'Subscript.',
    example: {
      type: 'text',
      text: '2',
      marks: [{ type: 'subscript' }],
    },
  },
  highlight: {
    category: 'mark',
    summary: 'Highlight background color.',
    attrs: { color: 'css color string' },
    example: {
      type: 'text',
      text: 'yellow',
      marks: [{ type: 'highlight', attrs: { color: '#ffff00' } }],
    },
  },
  textStyle: {
    category: 'mark',
    summary: 'Carrier for textStyle marks (color). Apply with Color.',
    attrs: { color: 'css color string' },
    example: {
      type: 'text',
      text: 'red',
      marks: [{ type: 'textStyle', attrs: { color: '#ff0000' } }],
    },
  },
  comment: {
    category: 'mark',
    summary: 'Inline comment anchor. Do not create directly; use commenting UI.',
    attrs: { commentId: 'uuid', resolved: 'boolean' },
    example: {
      type: 'text',
      text: 'commented',
      marks: [{ type: 'comment', attrs: { commentId: 'c1', resolved: false } }],
    },
  },
  // synthetic (MCP only)
  auto: {
    category: 'synthetic',
    summary:
      'MCP-only block placeholder. Server parses the markdown in `text` into real block nodes at save-time.',
    attrs: { format: 'markdown (default) | html', text: 'markdown source' },
    example: {
      type: 'auto',
      text: '# heading\n\n- one\n- two',
    },
  },
  autoInline: {
    category: 'synthetic',
    summary:
      'MCP-only inline placeholder. Expands to text+marks only (no blocks). Safe inside callout/listItem.',
    attrs: { format: 'markdown (default) | html', text: 'inline markdown' },
    example: {
      type: 'autoInline',
      text: '**bold** and `code`',
    },
  },
};

@Injectable()
export class DescribeContentSchemaTool {
  asTool(): McpTool {
    return {
      name: 'describe_content_schema',
      description:
        'Documentation tool. Returns the list of supported Tiptap node/mark types with attrs, allowed children, and JSON examples. Call without args for the overview, or pass nodeType (e.g. "callout", "taskItem", "link", "auto") to get detailed info for that one type. Use this before constructing page JSON to avoid schema errors.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeType: {
            type: 'string',
            description:
              'Optional. A single node or mark type name to describe in detail.',
          },
        },
        additionalProperties: false,
      },
      handler: async (args) => this.handle(args),
    };
  }

  private handle(args: Record<string, any>) {
    const nodeType = args.nodeType ? String(args.nodeType) : undefined;

    if (nodeType) {
      const doc = NODE_DOCS[nodeType];
      if (!doc) {
        return {
          error: `Unknown type "${nodeType}"`,
          hint: 'Call describe_content_schema without nodeType to see all supported types.',
        };
      }
      return { type: nodeType, ...doc };
    }

    const overview: Record<string, Array<{ type: string; summary: string }>> = {
      block: [],
      inline: [],
      mark: [],
      synthetic: [],
    };
    for (const [type, doc] of Object.entries(NODE_DOCS)) {
      overview[doc.category].push({ type, summary: doc.summary });
    }

    return {
      overview,
      notes: [
        'Every paragraph/heading gets auto-assigned `attrs.id` — do not set it manually.',
        'Block nodes live under doc.content. Inline nodes live under paragraph/heading/tableCell/etc.',
        'Marks wrap text nodes via the `marks` array. Combine multiple marks on the same text node.',
        'Prefer `auto` (block) or `autoInline` for new markdown content to save tokens — the server parses it at save time.',
      ],
      usage:
        'Call with nodeType="<type>" to get attrs, children rules, and a concrete JSON example.',
    };
  }
}
