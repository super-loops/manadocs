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
        'Update page metadata only (title, icon). Content cannot be modified here — use patch_page_blocks for all content edits.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'Page UUID or slug ID' },
          title: { type: 'string' },
          icon: { type: 'string' },
        },
        required: ['pageId'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    if (args.title === undefined && args.icon === undefined) {
      throw new BadRequestException(
        'Provide at least one of: title, icon',
      );
    }

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

    const user = await this.userRepo.findById(ctx.userId, ctx.workspaceId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.pageService.update(
      page,
      {
        pageId: page.id,
        title: args.title !== undefined ? String(args.title) : undefined,
        icon: args.icon !== undefined ? String(args.icon) : undefined,
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
