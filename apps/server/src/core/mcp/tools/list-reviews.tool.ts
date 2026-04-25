import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewService } from '../../review/review.service';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { PaginationOptions } from '@manadocs/db/pagination/pagination-options';
import { McpCallContext, McpTool } from '../mcp.types';
import { normalizePageId } from '../utils/identifiers';

@Injectable()
export class ListReviewsTool {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly pageRepo: PageRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'list_reviews',
      description:
        'List reviews on a page. Returns reviews ordered by recently updated. Optionally filter by status.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'Page UUID or slug ID' },
          status: {
            type: 'string',
            enum: ['open', 'progress', 'resolved'],
            description: 'Optional status filter',
          },
          limit: { type: 'number', description: 'Page size (default 20)' },
          cursor: { type: 'string', description: 'Pagination cursor' },
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

    const pagination = new PaginationOptions();
    pagination.limit = args.limit ?? 20;
    pagination.cursor = args.cursor;

    return this.reviewService.findByPageId(page.id, pagination, args.status);
  }
}
