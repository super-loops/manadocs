import { ApiTokenSpaceScope } from '../api-token/dto/create-api-token.dto';

export interface McpCallContext {
  userId: string;
  workspaceId: string;
  spaceScope: ApiTokenSpaceScope;
  allowedSpaceIds: string[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface McpTool extends McpToolDefinition {
  handler: (args: Record<string, any>, ctx: McpCallContext) => Promise<unknown>;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: string | number | null;
  result: any;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: any;
  };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export const MCP_PROTOCOL_VERSION = '2024-11-05';
export const MCP_SERVER_NAME = 'manadocs';
