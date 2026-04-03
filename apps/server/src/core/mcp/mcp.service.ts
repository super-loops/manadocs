import { HttpException, Injectable, Logger } from '@nestjs/common';
import { McpToolRegistry } from './mcp-tool.registry';
import { McpSessionService } from './mcp-session.service';
import { McpPromptService } from './mcp-prompt.service';
import {
  JSON_RPC_ERRORS,
  JsonRpcRequest,
  JsonRpcResponse,
  McpCallContext,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_NAME,
} from './mcp.types';

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly toolRegistry: McpToolRegistry,
    private readonly sessionService: McpSessionService,
    private readonly promptService: McpPromptService,
  ) {}

  async dispatch(
    req: JsonRpcRequest,
    ctx: McpCallContext,
  ): Promise<JsonRpcResponse | null> {
    const id = req.id ?? null;

    if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
      return this.error(id, JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid Request');
    }

    try {
      switch (req.method) {
        case 'initialize':
          return this.success(id, await this.handleInitialize(ctx));
        case 'initialized':
        case 'notifications/initialized':
          // notification: no response
          return null;
        case 'ping':
          return this.success(id, {});
        case 'tools/list':
          return this.success(id, this.handleToolsList());
        case 'tools/call':
          return this.success(id, await this.handleToolCall(req.params, ctx));
        default:
          return this.error(
            id,
            JSON_RPC_ERRORS.METHOD_NOT_FOUND,
            `Method not found: ${req.method}`,
          );
      }
    } catch (err) {
      if (err instanceof HttpException) {
        return this.error(id, JSON_RPC_ERRORS.INVALID_PARAMS, err.message);
      }
      this.logger.error('MCP dispatch error', err as any);
      return this.error(
        id,
        JSON_RPC_ERRORS.INTERNAL_ERROR,
        (err as Error).message ?? 'Internal error',
      );
    }
  }

  private async handleInitialize(ctx: McpCallContext) {
    const instructions = await this.promptService.buildSystemPrompt(
      ctx.workspaceId,
    );
    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: { listChanged: false },
      },
      serverInfo: {
        name: MCP_SERVER_NAME,
        version: '0.7.0',
      },
      instructions,
    };
  }

  private handleToolsList() {
    return {
      tools: this.toolRegistry.list().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  }

  private async handleToolCall(params: any, ctx: McpCallContext) {
    const name = params?.name;
    const args = params?.arguments ?? {};
    if (typeof name !== 'string') {
      throw new HttpException('tool name is required', 400);
    }
    const tool = this.toolRegistry.get(name);
    if (!tool) {
      throw new HttpException(`Unknown tool: ${name}`, 404);
    }
    const result = await tool.handler(args, ctx);
    return {
      content: [
        {
          type: 'text',
          text:
            typeof result === 'string'
              ? result
              : JSON.stringify(result, null, 2),
        },
      ],
      isError: false,
    };
  }

  private success(id: any, result: any): JsonRpcResponse {
    return { jsonrpc: '2.0', id, result };
  }

  private error(id: any, code: number, message: string): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }
}
