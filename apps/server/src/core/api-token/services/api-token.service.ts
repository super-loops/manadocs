import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { ApiTokenRepo } from '@manadocs/db/repos/api-token/api-token.repo';
import {
  ApiToken,
  InsertableApiToken,
} from '@manadocs/db/types/entity.types';
import {
  ApiTokenType,
  ApiTokenSpaceScope,
} from '../dto/create-api-token.dto';

export interface TokenSpaceInfo {
  id: string;
  name: string | null;
  slug: string;
}

export interface CreateTokenInput {
  name: string;
  permissions?: Record<string, boolean>;
  expiresAt?: Date;
  tokenType?: ApiTokenType;
  spaceScope?: ApiTokenSpaceScope;
  spaceIds?: string[];
}

export interface UpdateTokenInput {
  name?: string;
  permissions?: Record<string, boolean>;
  expiresAt?: Date | null;
  tokenType?: ApiTokenType;
  spaceScope?: ApiTokenSpaceScope;
  spaceIds?: string[];
}

export interface ApiTokenWithSpaces extends ApiToken {
  spaces: TokenSpaceInfo[];
}

export interface ApiTokenWithSecret extends ApiTokenWithSpaces {
  token: string;
}

@Injectable()
export class ApiTokenService {
  private readonly TOKEN_PREFIX = 'sd_';
  private readonly PREFIX_LENGTH = 8;
  private readonly TOKEN_LENGTH = 32;

  constructor(private apiTokenRepo: ApiTokenRepo) {}

  /**
   * Generates a new API token in format: sd_[32 random hex chars]
   */
  private generateToken(): { token: string; prefix: string } {
    const randomPart = randomBytes(this.TOKEN_LENGTH).toString('hex');
    const token = `${this.TOKEN_PREFIX}${randomPart}`;
    const prefix = token.substring(0, this.PREFIX_LENGTH);
    return { token, prefix };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Validates scope + spaceIds combination and that each spaceId belongs to the workspace.
   * Returns a deduped, validated spaceIds array (empty when scope='all').
   */
  private async resolveSpaceScope(
    workspaceId: string,
    scope: ApiTokenSpaceScope | undefined,
    spaceIds: string[] | undefined,
  ): Promise<{ scope: ApiTokenSpaceScope; spaceIds: string[] }> {
    const effectiveScope: ApiTokenSpaceScope = scope ?? 'all';

    if (effectiveScope === 'all') {
      return { scope: 'all', spaceIds: [] };
    }

    const ids = Array.from(new Set(spaceIds ?? []));
    if (ids.length === 0) {
      throw new BadRequestException(
        'spaceIds must contain at least one space when spaceScope is "selected"',
      );
    }

    const valid = await this.apiTokenRepo.findValidSpaceIdsForWorkspace(
      ids,
      workspaceId,
    );
    if (valid.length !== ids.length) {
      throw new BadRequestException(
        'One or more spaceIds do not belong to this workspace',
      );
    }

    return { scope: 'selected', spaceIds: valid };
  }

  private async loadSpaces(apiTokenId: string): Promise<TokenSpaceInfo[]> {
    return this.apiTokenRepo.findSpacesByTokenId(apiTokenId);
  }

  private async withSpaces(token: ApiToken): Promise<ApiTokenWithSpaces> {
    const spaces =
      (token as any).spaceScope === 'selected'
        ? await this.loadSpaces(token.id)
        : [];
    return { ...token, spaces };
  }

  /**
   * Create a new API token for a user
   */
  async createToken(
    userId: string,
    workspaceId: string,
    data: CreateTokenInput,
  ): Promise<ApiTokenWithSecret> {
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException('Token name is required');
    }

    const { scope, spaceIds } = await this.resolveSpaceScope(
      workspaceId,
      data.spaceScope,
      data.spaceIds,
    );

    const { token, prefix } = this.generateToken();
    const tokenHash = this.hashToken(token);
    const permissions = data.permissions || { read: true };

    const insertable: InsertableApiToken = {
      name: data.name,
      tokenHash,
      tokenPrefix: prefix,
      tokenType: data.tokenType ?? 'api',
      spaceScope: scope,
      userId,
      workspaceId,
      permissions,
      expiresAt: data.expiresAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.apiTokenRepo.insert(insertable);
    if (scope === 'selected') {
      await this.apiTokenRepo.replaceTokenSpaces(created.id, spaceIds);
    }

    const withSpaces = await this.withSpaces(created);
    return { ...withSpaces, token };
  }

  async getUserTokens(
    userId: string,
    workspaceId: string,
  ): Promise<ApiTokenWithSpaces[]> {
    const tokens = await this.apiTokenRepo.findByUserId(userId, workspaceId);
    return Promise.all(tokens.map((t) => this.withSpaces(t)));
  }

  async getTokenById(
    id: string,
    userId: string,
    workspaceId: string,
  ): Promise<ApiToken> {
    const token = await this.apiTokenRepo.findById(id, workspaceId);
    if (!token) {
      throw new NotFoundException('Token not found');
    }
    if (token.userId !== userId) {
      throw new ForbiddenException('Cannot access this token');
    }
    return token;
  }

  async getTokenWithSpaces(
    id: string,
    userId: string,
    workspaceId: string,
  ): Promise<ApiTokenWithSpaces> {
    const token = await this.getTokenById(id, userId, workspaceId);
    return this.withSpaces(token);
  }

  /**
   * Update token metadata (name, permissions, expiresAt, tokenType, spaceScope, spaceIds)
   */
  async updateToken(
    id: string,
    userId: string,
    workspaceId: string,
    data: UpdateTokenInput,
  ): Promise<ApiTokenWithSpaces> {
    const existing = await this.getTokenById(id, userId, workspaceId);

    if (data.name !== undefined && data.name.trim().length === 0) {
      throw new BadRequestException('Token name cannot be empty');
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.permissions !== undefined) patch.permissions = data.permissions;
    if (data.expiresAt !== undefined) patch.expiresAt = data.expiresAt;
    if (data.tokenType !== undefined) patch.tokenType = data.tokenType;

    const scopeProvided =
      data.spaceScope !== undefined || data.spaceIds !== undefined;
    let resolvedScope: ApiTokenSpaceScope | undefined;
    let resolvedSpaceIds: string[] | undefined;

    if (scopeProvided) {
      // When only spaceIds is provided, infer scope from existing or from ids length
      const effectiveScope: ApiTokenSpaceScope =
        data.spaceScope ??
        ((existing as any).spaceScope as ApiTokenSpaceScope) ??
        'all';
      const resolved = await this.resolveSpaceScope(
        workspaceId,
        effectiveScope,
        data.spaceIds,
      );
      resolvedScope = resolved.scope;
      resolvedSpaceIds = resolved.spaceIds;
      patch.spaceScope = resolvedScope;
    }

    await this.apiTokenRepo.update(id, patch as any);

    if (scopeProvided) {
      if (resolvedScope === 'all') {
        // Clear any previously-selected spaces
        await this.apiTokenRepo.replaceTokenSpaces(id, []);
      } else if (resolvedScope === 'selected') {
        await this.apiTokenRepo.replaceTokenSpaces(id, resolvedSpaceIds ?? []);
      }
    }

    return this.getTokenWithSpaces(id, userId, workspaceId);
  }

  /**
   * Regenerate a token's secret — returns the new full token once.
   */
  async regenerateToken(
    id: string,
    userId: string,
    workspaceId: string,
  ): Promise<ApiTokenWithSecret> {
    await this.getTokenById(id, userId, workspaceId);

    const { token, prefix } = this.generateToken();
    const tokenHash = this.hashToken(token);

    await this.apiTokenRepo.update(id, {
      tokenHash,
      tokenPrefix: prefix,
      lastUsedAt: null,
      updatedAt: new Date(),
    } as any);

    const withSpaces = await this.getTokenWithSpaces(id, userId, workspaceId);
    return { ...withSpaces, token };
  }

  async deleteToken(
    id: string,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.getTokenById(id, userId, workspaceId);
    await this.apiTokenRepo.delete(id);
  }

  /**
   * Validate a token and return its associated user/workspace + space scope
   */
  async validateToken(token: string): Promise<{
    userId: string;
    workspaceId: string;
    apiToken: ApiToken;
    spaceScope: ApiTokenSpaceScope;
    allowedSpaceIds: string[];
  } | null> {
    if (!token.startsWith(this.TOKEN_PREFIX)) {
      return null;
    }

    const tokenHash = this.hashToken(token);
    const apiToken = await this.apiTokenRepo.findByTokenHash(tokenHash);

    if (!apiToken) {
      return null;
    }

    if (apiToken.expiresAt && new Date() > apiToken.expiresAt) {
      return null;
    }

    await this.apiTokenRepo.update(apiToken.id, { lastUsedAt: new Date() });

    const scope =
      ((apiToken as any).spaceScope as ApiTokenSpaceScope) ?? 'all';
    const allowedSpaceIds =
      scope === 'selected'
        ? await this.apiTokenRepo.findSpaceIdsByTokenId(apiToken.id)
        : [];

    return {
      userId: apiToken.userId,
      workspaceId: apiToken.workspaceId,
      apiToken,
      spaceScope: scope,
      allowedSpaceIds,
    };
  }

  async cleanupExpiredTokens(): Promise<void> {
    await this.apiTokenRepo.deleteExpiredTokens();
  }
}
