import { Injectable } from '@nestjs/common';
import { WorkspaceRepo } from '@manadocs/db/repos/workspace/workspace.repo';
import { McpCallContext, McpTool } from '../mcp.types';

@Injectable()
export class WorkspaceInfoTool {
  constructor(private readonly workspaceRepo: WorkspaceRepo) {}

  asTool(): McpTool {
    return {
      name: 'workspace_info',
      description:
        'Get information about the current workspace: name, description, and MCP instructions.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      handler: (_args, ctx) => this.handle(ctx),
    };
  }

  private async handle(ctx: McpCallContext) {
    const workspace = await this.workspaceRepo.findById(ctx.workspaceId);
    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      mcpInstructions: workspace.mcpInstructions,
    };
  }
}
