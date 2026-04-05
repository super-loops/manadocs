import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { McpCallContext, McpTool } from '../mcp.types';
import { jsonToText } from '../../../collaboration/collaboration.util';

@Injectable()
export class SearchInPageTool {
  constructor(private readonly pageRepo: PageRepo) {}

  asTool(): McpTool {
    return {
      name: 'search_in_page',
      description:
        'Search for text within a single page. Returns top-level blocks (paragraphs, headings, lists, etc.) that contain the query, with blockIndex, blockId (when available), type, and a text snippet. Use this to locate where to patch, then call patch_page_blocks.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'Page UUID or slug ID' },
          query: { type: 'string', description: 'Text to search for' },
          caseSensitive: { type: 'boolean', description: 'Default false' },
          limit: {
            type: 'integer',
            description: 'Max matches (default 20, max 100)',
            minimum: 1,
            maximum: 100,
          },
          snippetLength: {
            type: 'integer',
            description: 'Snippet length around match (default 120)',
            minimum: 20,
            maximum: 500,
          },
        },
        required: ['pageId', 'query'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const pageId = String(args.pageId);
    const query = String(args.query ?? '');
    if (!query) return { matches: [], totalBlocks: 0 };

    const caseSensitive = Boolean(args.caseSensitive);
    const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);
    const snippetLength = Math.min(
      Math.max(Number(args.snippetLength) || 120, 20),
      500,
    );

    const page = await this.pageRepo.findById(pageId, { includeContent: true });
    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }
    if (page.workspaceId !== ctx.workspaceId) {
      throw new NotFoundException('Page not found');
    }
    if (
      ctx.spaceScope === 'selected' &&
      !ctx.allowedSpaceIds.includes(page.spaceId)
    ) {
      throw new ForbiddenException('Page space not in token scope');
    }

    const content: any = page.content;
    const blocks: any[] =
      content && Array.isArray(content.content) ? content.content : [];

    const needle = caseSensitive ? query : query.toLowerCase();
    const matches: any[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      let text = '';
      try {
        text = jsonToText({ type: 'doc', content: [block] }) || '';
      } catch {
        text = '';
      }
      const haystack = caseSensitive ? text : text.toLowerCase();
      const idx = haystack.indexOf(needle);
      if (idx === -1) continue;

      const half = Math.floor(snippetLength / 2);
      const start = Math.max(0, idx - half);
      const end = Math.min(text.length, idx + query.length + half);
      const snippet =
        (start > 0 ? '…' : '') +
        text.slice(start, end) +
        (end < text.length ? '…' : '');

      matches.push({
        blockIndex: i,
        blockId: block?.attrs?.id ?? null,
        type: block?.type ?? 'unknown',
        snippet,
        textLength: text.length,
      });
      if (matches.length >= limit) break;
    }

    return {
      matches,
      totalBlocks: blocks.length,
      truncated: matches.length >= limit,
    };
  }
}
