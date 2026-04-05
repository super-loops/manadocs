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
