import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { McpTokenGuard } from './mcp-token.guard';
import { McpService } from './mcp.service';
import { McpSessionService } from './mcp-session.service';
import { JsonRpcRequest, McpCallContext } from './mcp.types';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';

@Controller('mcp')
@UseGuards(McpTokenGuard)
export class McpController {
  constructor(
    private readonly mcpService: McpService,
    private readonly sessionService: McpSessionService,
  ) {}

  @Post()
  @SkipTransform()
  async rpc(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() body: JsonRpcRequest | JsonRpcRequest[],
  ) {
    const ctx = (req as any).mcp as McpCallContext;

    // create or reuse session
    let sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !this.sessionService.get(sessionId)) {
      sessionId = this.sessionService.create(ctx.userId, ctx.workspaceId);
    }
    res.header('Mcp-Session-Id', sessionId);

    if (Array.isArray(body)) {
      const responses = await Promise.all(
        body.map((r) => this.mcpService.dispatch(r, ctx)),
      );
      const filtered = responses.filter((r) => r !== null);
      return filtered;
    }

    const response = await this.mcpService.dispatch(body, ctx);
    if (response === null) {
      res.status(202);
      return null;
    }
    return response;
  }

  @Get()
  @HttpCode(204)
  @SkipTransform()
  stream() {
    // SSE stub — streaming transport not yet implemented
    return null;
  }

  @Delete()
  @HttpCode(204)
  @SkipTransform()
  terminate(@Req() req: FastifyRequest) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId) {
      this.sessionService.destroy(sessionId);
    }
    return null;
  }
}
