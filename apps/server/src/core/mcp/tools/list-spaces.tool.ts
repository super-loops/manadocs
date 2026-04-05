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
          includeSpaceDetail: {
            type: 'boolean',
            description:
              'Include description and authoringRules (default true). Set false after the first call to save tokens.',
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

    const includeDetail = args.includeSpaceDetail !== false;
    let items = result.items.map((s: any) => {
      const base: Record<string, any> = {
        id: s.id,
        name: s.name,
        slug: s.slug,
        visibility: s.visibility,
      };
      if (includeDetail) {
        base.description = s.description;
        base.authoringRules = s.authoringRules;
      }
      return base;
    });

    if (ctx.spaceScope === 'selected') {
      const allowed = new Set(ctx.allowedSpaceIds);
      items = items.filter((s) => allowed.has(s.id));
    }

    return { spaces: items, count: items.length };
  }
}
