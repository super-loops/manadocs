import { Injectable, NotFoundException } from '@nestjs/common';
import { ReviewService } from '../../review/review.service';
import { UserRepo } from '@manadocs/db/repos/user/user.repo';
import { McpCallContext, McpTool } from '../mcp.types';

@Injectable()
export class DeleteReviewCommentTool {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly userRepo: UserRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'delete_review_comment',
      description:
        'Soft-delete a review comment. Only the original author can delete. The history entry is marked deleted but remains in the timeline.',
      inputSchema: {
        type: 'object',
        properties: {
          historyId: { type: 'string', description: 'Comment history entry UUID' },
        },
        required: ['historyId'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const user = await this.userRepo.findById(ctx.userId, ctx.workspaceId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.reviewService.deleteComment(
      { historyId: String(args.historyId) },
      user,
    );
    return { success: true };
  }
}
