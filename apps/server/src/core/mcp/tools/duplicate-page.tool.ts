import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { SpaceRepo } from '@manadocs/db/repos/space/space.repo';
import { UserRepo } from '@manadocs/db/repos/user/user.repo';
import { PageService } from '../../page/services/page.service';
import { McpCallContext, McpTool } from '../mcp.types';
import { normalizePageId } from '../utils/identifiers';

@Injectable()
export class DuplicatePageTool {
  constructor(
    private readonly pageService: PageService,
    private readonly pageRepo: PageRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly userRepo: UserRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'duplicate_page',
      description:
        'Duplicate a page (including all descendants) within the same space or into another space. Optionally override the duplicated root page title/icon. Content edits must still go through patch_page_blocks.',
      inputSchema: {
        type: 'object',
        properties: {
          sourcePageId: {
            type: 'string',
            description: 'Page UUID or slug ID to duplicate',
          },
          targetSpaceId: {
            type: 'string',
            description:
              'Optional target space UUID or slug. Omit to duplicate in the source space.',
          },
          title: {
            type: 'string',
            description: 'Optional new title for the duplicated root page',
          },
          icon: {
            type: 'string',
            description: 'Optional new icon for the duplicated root page',
          },
        },
        required: ['sourcePageId'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const sourcePageId = normalizePageId(args.sourcePageId);
    const sourcePage = await this.pageRepo.findById(sourcePageId);
    if (!sourcePage || sourcePage.deletedAt) {
      throw new NotFoundException('Source page not found');
    }
    if (sourcePage.workspaceId !== ctx.workspaceId) {
      throw new NotFoundException('Source page not found');
    }
    if (
      ctx.spaceScope === 'selected' &&
      !ctx.allowedSpaceIds.includes(sourcePage.spaceId)
    ) {
      throw new ForbiddenException('Source page space not in token scope');
    }

    let targetSpaceId: string | undefined;
    if (args.targetSpaceId) {
      const targetSpace = await this.spaceRepo.findById(
        String(args.targetSpaceId),
        ctx.workspaceId,
      );
      if (!targetSpace) {
        throw new NotFoundException('Target space not found');
      }
      if (
        ctx.spaceScope === 'selected' &&
        !ctx.allowedSpaceIds.includes(targetSpace.id)
      ) {
        throw new ForbiddenException('Target space not in token scope');
      }
      targetSpaceId = targetSpace.id;
    }

    const user = await this.userRepo.findById(ctx.userId, ctx.workspaceId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const duplicated = await this.pageService.duplicatePage(
      sourcePage,
      targetSpaceId,
      user,
    );

    const hasOverride =
      args.title !== undefined || args.icon !== undefined;
    let finalPage: any = duplicated;
    if (hasOverride) {
      finalPage = await this.pageService.update(
        duplicated as any,
        {
          pageId: duplicated.id,
          title:
            args.title !== undefined ? String(args.title) : undefined,
          icon: args.icon !== undefined ? String(args.icon) : undefined,
        },
        user,
      );
    }

    return {
      id: finalPage.id,
      slugId: finalPage.slugId,
      title: finalPage.title,
      icon: finalPage.icon,
      spaceId: finalPage.spaceId,
      parentPageId: finalPage.parentPageId,
      hasChildren: (duplicated as any).hasChildren ?? false,
      childPageCount: ((duplicated as any).childPageIds ?? []).length,
    };
  }
}
