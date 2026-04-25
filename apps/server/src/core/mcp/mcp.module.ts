import { Module } from '@nestjs/common';
import { ApiTokenModule } from '../api-token/api-token.module';
import { PageModule } from '../page/page.module';
import { SearchModule } from '../search/search.module';
import { CollaborationModule } from '../../collaboration/collaboration.module';
import { ReviewModule } from '../review/review.module';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { McpSessionService } from './mcp-session.service';
import { McpPromptService } from './mcp-prompt.service';
import { McpTokenGuard } from './mcp-token.guard';
import { McpToolRegistry } from './mcp-tool.registry';
import { WorkspaceInfoTool } from './tools/workspace-info.tool';
import { ListSpacesTool } from './tools/list-spaces.tool';
import { ListPagesTool } from './tools/list-pages.tool';
import { GetPageTool } from './tools/get-page.tool';
import { SearchPagesTool } from './tools/search-pages.tool';
import { CreatePageTool } from './tools/create-page.tool';
import { UpdatePageTool } from './tools/update-page.tool';
import { GetPageTreeTool } from './tools/get-page-tree.tool';
import { SearchInPageTool } from './tools/search-in-page.tool';
import { PatchPageBlocksTool } from './tools/patch-page-blocks.tool';
import { DescribeContentSchemaTool } from './tools/describe-content-schema.tool';
import { DuplicatePageTool } from './tools/duplicate-page.tool';
import { ListReviewsTool } from './tools/list-reviews.tool';
import { GetReviewTool } from './tools/get-review.tool';
import { CreateReviewTool } from './tools/create-review.tool';
import { UpdateReviewTool } from './tools/update-review.tool';
import { AddReviewCommentTool } from './tools/add-review-comment.tool';
import { UpdateReviewCommentTool } from './tools/update-review-comment.tool';
import { DeleteReviewCommentTool } from './tools/delete-review-comment.tool';

@Module({
  imports: [
    ApiTokenModule,
    PageModule,
    SearchModule,
    CollaborationModule,
    ReviewModule,
  ],
  controllers: [McpController],
  providers: [
    McpService,
    McpSessionService,
    McpPromptService,
    McpTokenGuard,
    McpToolRegistry,
    WorkspaceInfoTool,
    ListSpacesTool,
    ListPagesTool,
    GetPageTool,
    SearchPagesTool,
    CreatePageTool,
    UpdatePageTool,
    GetPageTreeTool,
    SearchInPageTool,
    PatchPageBlocksTool,
    DescribeContentSchemaTool,
    DuplicatePageTool,
    ListReviewsTool,
    GetReviewTool,
    CreateReviewTool,
    UpdateReviewTool,
    AddReviewCommentTool,
    UpdateReviewCommentTool,
    DeleteReviewCommentTool,
  ],
  exports: [McpPromptService, McpToolRegistry],
})
export class McpModule {}
