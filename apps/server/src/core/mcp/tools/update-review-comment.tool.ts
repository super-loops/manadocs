import { Injectable, NotFoundException } from '@nestjs/common';
import { ReviewService } from '../../review/review.service';
import { UserRepo } from '@manadocs/db/repos/user/user.repo';
import { McpCallContext, McpTool } from '../mcp.types';

@Injectable()
export class UpdateReviewCommentTool {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly userRepo: UserRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'update_review_comment',
      description:
        'Edit a review comment. Only the original author can edit. The history entry is marked as edited.',
      inputSchema: {
        type: 'object',
        properties: {
          historyId: { type: 'string', description: 'Comment history entry UUID' },
          content: { type: 'string', description: 'New markdown body' },
        },
        required: ['historyId', 'content'],
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

    return this.reviewService.updateComment(
      { historyId: String(args.historyId), content: String(args.content) },
      user,
    );
  }
}
