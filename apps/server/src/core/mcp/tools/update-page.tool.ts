import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { UserRepo } from '@manadocs/db/repos/user/user.repo';
import { PageService } from '../../page/services/page.service';
import { McpCallContext, McpTool } from '../mcp.types';
import {
  docContainsAutoNodes,
  expandAutoNodes,
} from '../utils/expand-auto-nodes';
import { normalizePageId } from '../utils/identifiers';

@Injectable()
export class UpdatePageTool {
  constructor(
    private readonly pageService: PageService,
    private readonly pageRepo: PageRepo,
    private readonly userRepo: UserRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'update_page',
      description:
        'Update a page. Any subset of title, icon, content may be provided. When content is given, operation (append|prepend|replace) and format (markdown|html|json) are required. JSON content may embed {type:"auto",text:"..."} or {type:"autoInline",text:"..."} nodes which are expanded server-side.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'Page UUID or slug ID' },
          title: { type: 'string' },
          icon: { type: 'string' },
          content: {
            description:
              'New content (string for markdown/html, object for json)',
          },
          operation: {
            type: 'string',
            enum: ['append', 'prepend', 'replace'],
            description: 'Required when content is provided',
          },
          format: {
            type: 'string',
            enum: ['markdown', 'html', 'json'],
            description: 'Required when content is provided',
          },
        },
        required: ['pageId'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const pageId = normalizePageId(args.pageId);
    const page = await this.pageRepo.findById(pageId);
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

    const hasContent = args.content !== undefined && args.content !== null;
    if (hasContent && (!args.operation || !args.format)) {
      throw new BadRequestException(
        'operation and format are required when content is provided',
      );
    }

    const user = await this.userRepo.findById(ctx.userId, ctx.workspaceId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let content = args.content;
    const format = args.format as 'markdown' | 'html' | 'json' | undefined;
    if (hasContent && format === 'json' && docContainsAutoNodes(content)) {
      content = await expandAutoNodes(content);
    }

    const updated = await this.pageService.update(
      page,
      {
        pageId: page.id,
        title: args.title !== undefined ? String(args.title) : undefined,
        icon: args.icon !== undefined ? String(args.icon) : undefined,
        content: hasContent ? content : undefined,
        operation: hasContent
          ? (args.operation as 'append' | 'prepend' | 'replace')
          : undefined,
        format: hasContent ? format : undefined,
      },
      user,
    );

    return {
      id: updated.id,
      slugId: updated.slugId,
      title: updated.title,
      icon: updated.icon,
      spaceId: updated.spaceId,
      updatedAt: updated.updatedAt,
    };
  }
}
