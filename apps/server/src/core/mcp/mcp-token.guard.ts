import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTokenService } from '../api-token/services/api-token.service';

@Injectable()
export class McpTokenGuard implements CanActivate {
  constructor(private readonly apiTokenService: ApiTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    const token = authHeader.substring('Bearer '.length);
    const validation = await this.apiTokenService.validateToken(token);
    if (!validation) {
      throw new UnauthorizedException('Invalid or expired API token');
    }

    const tokenType = (validation.apiToken as any).tokenType ?? 'api';
    if (tokenType !== 'mcp' && tokenType !== 'both') {
      throw new ForbiddenException('Token does not grant MCP access');
    }

    request.mcp = {
      userId: validation.userId,
      workspaceId: validation.workspaceId,
      spaceScope: validation.spaceScope,
      allowedSpaceIds: validation.allowedSpaceIds,
    };

    return true;
  }
}
