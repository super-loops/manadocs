import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTokenService } from '../services/api-token.service';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private apiTokenService: ApiTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring('Bearer '.length);

    const validation = await this.apiTokenService.validateToken(token);

    if (!validation) {
      throw new UnauthorizedException('Invalid or expired API token');
    }

    // Attach validated user, workspace, and token scope to request
    request.user = {
      id: validation.userId,
      apiToken: validation.apiToken,
      apiTokenSpaceScope: validation.spaceScope,
      apiTokenAllowedSpaceIds: validation.allowedSpaceIds,
    };

    request.workspace = {
      id: validation.workspaceId,
    };

    return true;
  }
}
