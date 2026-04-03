import { Injectable } from '@nestjs/common';
import { SearchService } from '../../search/search.service';
import { McpCallContext, McpTool } from '../mcp.types';

@Injectable()
export class SearchPagesTool {
  constructor(private readonly searchService: SearchService) {}

  asTool(): McpTool {
    return {
      name: 'search_pages',
      description:
        'Full-text search for pages by query. Returns ranked results with highlights.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          spaceId: {
            type: 'string',
            description: 'Optional: limit search to a single space',
          },
          limit: {
            type: 'integer',
            description: 'Max results (default 25, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 100);
    const result = await this.searchService.searchPage(
      {
        query: String(args.query ?? ''),
        spaceId: args.spaceId ? String(args.spaceId) : undefined,
        limit,
        offset: 0,
      } as any,
      { userId: ctx.userId, workspaceId: ctx.workspaceId },
    );

    let items = result.items;
    if (ctx.spaceScope === 'selected') {
      const allowed = new Set(ctx.allowedSpaceIds);
      items = items.filter((item: any) => allowed.has(item.spaceId));
    }

    return { results: items, count: items.length };
  }
}
