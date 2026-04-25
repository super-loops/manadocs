import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewService } from '../../review/review.service';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { McpCallContext, McpTool } from '../mcp.types';

@Injectable()
export class GetReviewTool {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly pageRepo: PageRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'get_review',
      description:
        'Fetch a review by UUID. Returns the review with creator, assignees, anchors, and full history (comments + status changes).',
      inputSchema: {
        type: 'object',
        properties: {
          reviewId: { type: 'string', description: 'Review UUID' },
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

    const histories = await this.reviewService.findHistoriesByReviewId(
      review.id,
    );
    return { ...review, histories };
  }
}
