import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewService } from '../../review/review.service';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { UserRepo } from '@manadocs/db/repos/user/user.repo';
import { McpCallContext, McpTool } from '../mcp.types';

@Injectable()
export class UpdateReviewTool {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly pageRepo: PageRepo,
    private readonly userRepo: UserRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'update_review',
      description:
        'Update a review title and/or markdown content. Pass only the fields you want to change.',
      inputSchema: {
        type: 'object',
        properties: {
          reviewId: { type: 'string', description: 'Review UUID' },
          title: { type: 'string', description: 'New title' },
          content: { type: 'string', description: 'New markdown body' },
        },
        required: ['reviewId'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const review = await this.reviewService.findById(String(args.reviewId));
    if ((review as any).workspaceId !== ctx.workspaceId) {
      throw new NotFoundException('Review not found');
    }
    if (review.pageId) {
      const page = await this.pageRepo.findById(review.pageId);
      if (
        page &&
        ctx.spaceScope === 'selected' &&
        !ctx.allowedSpaceIds.includes(page.spaceId)
      ) {
        throw new ForbiddenException('Review space not in token scope');
      }
    }

    const user = await this.userRepo.findById(ctx.userId, ctx.workspaceId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.reviewService.updateReview(
      {
        reviewId: String(args.reviewId),
        title: args.title !== undefined ? String(args.title) : undefined,
        content: args.content !== undefined ? String(args.content) : undefined,
      },
      user,
    );
  }
}
