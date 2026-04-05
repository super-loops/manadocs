import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { SpaceRepo } from '@manadocs/db/repos/space/space.repo';
import { McpCallContext, McpTool } from '../mcp.types';

@Injectable()
export class ListPagesTool {
  constructor(
    private readonly pageRepo: PageRepo,
    private readonly spaceRepo: SpaceRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'list_pages',
      description:
        'List recent pages in a space. Returns title, slug, and metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          spaceId: { type: 'string', description: 'Space UUID' },
          limit: {
            type: 'integer',
            description: 'Max pages (default 50, max 100)',
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['spaceId'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const space = await this.spaceRepo.findById(
      String(args.spaceId),
      ctx.workspaceId,
    );
    if (!space) {
      throw new NotFoundException('Space not found');
    }
    const spaceId = space.id;
    if (
      ctx.spaceScope === 'selected' &&
      !ctx.allowedSpaceIds.includes(spaceId)
    ) {
      throw new ForbiddenException('Space not in token scope');
    }
    const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 100);
    const result = await this.pageRepo.getRecentPagesInSpace(spaceId, {
      limit,
    } as any);

    return {
      pages: result.items.map((p: any) => ({
        id: p.id,
        slugId: p.slugId,
        title: p.title,
        icon: p.icon,
        parentPageId: p.parentPageId,
        spaceId: p.spaceId,
        updatedAt: p.updatedAt,
      })),
      count: result.items.length,
    };
  }
}
