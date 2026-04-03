import { Injectable } from '@nestjs/common';
import { SpaceRepo } from '@manadocs/db/repos/space/space.repo';
import { McpCallContext, McpTool } from '../mcp.types';

@Injectable()
export class ListSpacesTool {
  constructor(private readonly spaceRepo: SpaceRepo) {}

  asTool(): McpTool {
    return {
      name: 'list_spaces',
      description:
        'List spaces accessible to the current API token in the workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional name filter' },
          limit: {
            type: 'integer',
            description: 'Max number of spaces (default 50, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 100);
    const result = await this.spaceRepo.getSpacesInWorkspace(
      ctx.workspaceId,
      {
        limit,
        query: typeof args.query === 'string' ? args.query : undefined,
      } as any,
    );

    let items = result.items.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      visibility: s.visibility,
    }));

    if (ctx.spaceScope === 'selected') {
      const allowed = new Set(ctx.allowedSpaceIds);
      items = items.filter((s) => allowed.has(s.id));
    }

    return { spaces: items, count: items.length };
  }
}
