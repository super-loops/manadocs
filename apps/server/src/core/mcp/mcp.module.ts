import { Module } from '@nestjs/common';
import { ApiTokenModule } from '../api-token/api-token.module';
import { PageModule } from '../page/page.module';
import { SearchModule } from '../search/search.module';
import { CollaborationModule } from '../../collaboration/collaboration.module';
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

@Module({
  imports: [ApiTokenModule, PageModule, SearchModule, CollaborationModule],
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
  ],
  exports: [McpPromptService, McpToolRegistry],
})
export class McpModule {}
