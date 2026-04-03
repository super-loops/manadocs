import { ForbiddenException, Injectable } from '@nestjs/common';
import { PageService } from '../../page/services/page.service';
import { McpCallContext, McpTool } from '../mcp.types';

@Injectable()
export class CreatePageTool {
  constructor(private readonly pageService: PageService) {}

  asTool(): McpTool {
    return {
      name: 'create_page',
      description:
        'Create a new page in a space. Content accepts markdown, html, or prosemirror JSON.',
      inputSchema: {
        type: 'object',
        properties: {
          spaceId: { type: 'string', description: 'Space UUID' },
          title: { type: 'string' },
          content: {
            type: 'string',
            description: 'Page body content',
          },
          format: {
            type: 'string',
            enum: ['markdown', 'html', 'json'],
            description: 'Content format (default: markdown)',
          },
          parentPageId: {
            type: 'string',
            description: 'Optional parent page UUID',
          },
          icon: { type: 'string', description: 'Optional icon emoji' },
        },
        required: ['spaceId'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const spaceId = String(args.spaceId);
    if (
      ctx.spaceScope === 'selected' &&
      !ctx.allowedSpaceIds.includes(spaceId)
    ) {
      throw new ForbiddenException('Space not in token scope');
    }

    const page = await this.pageService.create(ctx.userId, ctx.workspaceId, {
      spaceId,
      title: args.title ? String(args.title) : undefined,
      icon: args.icon ? String(args.icon) : undefined,
      parentPageId: args.parentPageId
        ? String(args.parentPageId)
        : undefined,
      content: args.content,
      format: (args.format as 'markdown' | 'html' | 'json') ?? 'markdown',
    });

    return {
      id: page.id,
      slugId: page.slugId,
      title: page.title,
      spaceId: page.spaceId,
    };
  }
}
