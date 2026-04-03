import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@manadocs/db/types/entity.types';
import {
  ApiTokenService,
  ApiTokenWithSecret,
  ApiTokenWithSpaces,
} from './services/api-token.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { UpdateApiTokenDto } from './dto/update-api-token.dto';

function serializeToken(token: ApiTokenWithSpaces) {
  return {
    id: token.id,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    tokenType: token.tokenType,
    permissions: token.permissions,
    spaceScope: (token as any).spaceScope ?? 'all',
    spaces: token.spaces,
    lastUsedAt: token.lastUsedAt,
    expiresAt: token.expiresAt,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
  };
}

function serializeTokenWithSecret(token: ApiTokenWithSecret) {
  return {
    ...serializeToken(token),
    token: token.token,
  };
}

@Controller('api-tokens')
@UseGuards(JwtAuthGuard)
export class ApiTokenController {
  constructor(private apiTokenService: ApiTokenService) {}

  @Post()
  async createToken(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() createDto: CreateApiTokenDto,
  ) {
    const token = await this.apiTokenService.createToken(user.id, workspace.id, {
      name: createDto.name,
      permissions: createDto.permissions,
      expiresAt: createDto.expiresAt
        ? new Date(createDto.expiresAt)
        : undefined,
      tokenType: createDto.tokenType,
      spaceScope: createDto.spaceScope,
      spaceIds: createDto.spaceIds,
    });
    return serializeTokenWithSecret(token);
  }

  @Get()
  async getTokens(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const tokens = await this.apiTokenService.getUserTokens(
      user.id,
      workspace.id,
    );
    return tokens.map(serializeToken);
  }

  @Patch(':id')
  async updateToken(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Body() updateDto: UpdateApiTokenDto,
  ) {
    const token = await this.apiTokenService.updateToken(
      id,
      user.id,
      workspace.id,
      {
        name: updateDto.name,
        permissions: updateDto.permissions,
        expiresAt:
          updateDto.expiresAt === undefined
            ? undefined
            : updateDto.expiresAt === null
              ? null
              : new Date(updateDto.expiresAt),
        tokenType: updateDto.tokenType,
        spaceScope: updateDto.spaceScope,
        spaceIds: updateDto.spaceIds,
      },
    );
    return serializeToken(token);
  }

  @Post(':id/regenerate')
  async regenerateToken(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Param('id') id: string,
  ) {
    const token = await this.apiTokenService.regenerateToken(
      id,
      user.id,
      workspace.id,
    );
    return serializeTokenWithSecret(token);
  }

  @Delete(':id')
  async deleteToken(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Param('id') id: string,
  ) {
    await this.apiTokenService.deleteToken(id, user.id, workspace.id);
    return { success: true };
  }
}
