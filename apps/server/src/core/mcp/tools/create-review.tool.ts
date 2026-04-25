import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewService } from '../../review/review.service';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { UserRepo } from '@manadocs/db/repos/user/user.repo';
import { McpCallContext, McpTool } from '../mcp.types';
import { normalizePageId } from '../utils/identifiers';

@Injectable()
export class CreateReviewTool {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly pageRepo: PageRepo,
    private readonly userRepo: UserRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'create_review',
      description:
        'Create a review on a page with an optional title and markdown content. The first comment is created from `content` automatically. Optional assignees are user/group UUIDs.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'Page UUID or slug ID' },
          title: { type: 'string', description: 'Review title (optional)' },
          content: {
            type: 'string',
            description: 'Review body as markdown (optional, becomes the first comment)',
          },
          assigneeUserIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional assignee user UUIDs',
          },
          assigneeGroupIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional assignee group UUIDs',
          },
        },
        required: ['pageId'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const pageId = normalizePageId(String(args.pageId));
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

    return this.reviewService.create(
      { page, workspaceId: ctx.workspaceId, user },
      {
        pageId: page.id,
        title: args.title ? String(args.title) : undefined,
        content: args.content ? String(args.content) : undefined,
        assigneeUserIds: args.assigneeUserIds,
        assigneeGroupIds: args.assigneeGroupIds,
      },
    );
  }
}
