import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { McpCallContext, McpTool } from '../mcp.types';

@Injectable()
export class GetPageTool {
  constructor(private readonly pageRepo: PageRepo) {}

  asTool(): McpTool {
    return {
      name: 'get_page',
      description:
        'Fetch a page by its UUID or slug ID. Returns full content as text.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'Page UUID or slug ID' },
        },
        required: ['pageId'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const pageId = String(args.pageId);
    const page = await this.pageRepo.findById(pageId, {
      includeTextContent: true,
      includeContent: true,
    });
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

    return {
      id: page.id,
      slugId: page.slugId,
      title: page.title,
      icon: page.icon,
      spaceId: page.spaceId,
      parentPageId: page.parentPageId,
      textContent: page.textContent,
      content: page.content,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }
}
