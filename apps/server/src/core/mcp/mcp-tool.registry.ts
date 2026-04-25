import { Injectable } from '@nestjs/common';
import { McpTool } from './mcp.types';
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

@Injectable()
export class McpToolRegistry {
  private toolsByName: Map<string, McpTool>;

  constructor(
    workspaceInfo: WorkspaceInfoTool,
    listSpaces: ListSpacesTool,
    listPages: ListPagesTool,
    getPage: GetPageTool,
    searchPages: SearchPagesTool,
    createPage: CreatePageTool,
    updatePage: UpdatePageTool,
    getPageTree: GetPageTreeTool,
    searchInPage: SearchInPageTool,
    patchPageBlocks: PatchPageBlocksTool,
    describeContentSchema: DescribeContentSchemaTool,
    duplicatePage: DuplicatePageTool,
    listReviews: ListReviewsTool,
    getReview: GetReviewTool,
    createReview: CreateReviewTool,
    updateReview: UpdateReviewTool,
    addReviewComment: AddReviewCommentTool,
    updateReviewComment: UpdateReviewCommentTool,
    deleteReviewComment: DeleteReviewCommentTool,
  ) {
    const tools: McpTool[] = [
      workspaceInfo.asTool(),
      listSpaces.asTool(),
      listPages.asTool(),
      getPage.asTool(),
      searchPages.asTool(),
      createPage.asTool(),
      updatePage.asTool(),
      getPageTree.asTool(),
      searchInPage.asTool(),
      patchPageBlocks.asTool(),
      describeContentSchema.asTool(),
      duplicatePage.asTool(),
      listReviews.asTool(),
      getReview.asTool(),
      createReview.asTool(),
      updateReview.asTool(),
      addReviewComment.asTool(),
      updateReviewComment.asTool(),
      deleteReviewComment.asTool(),
    ];
    this.toolsByName = new Map(tools.map((t) => [t.name, t]));
  }

  list(): McpTool[] {
    return Array.from(this.toolsByName.values());
  }

  get(name: string): McpTool | undefined {
    return this.toolsByName.get(name);
  }
}
