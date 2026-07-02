import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { PageVersionRepo } from '@manadocs/db/repos/page/page-version.repo';
import { UserRepo } from '@manadocs/db/repos/user/user.repo';
import { Page } from '@manadocs/db/types/entity.types';
import { PageVersionService } from '../../page/services/page-version.service';
import { McpCallContext, McpTool } from '../mcp.types';
import { normalizePageId } from '../utils/identifiers';

/** MCP 공용 — 페이지 접근 검증 (workspace + space scope) */
async function assertPageAccess(
  pageRepo: PageRepo,
  pageId: string,
  ctx: McpCallContext,
): Promise<Page> {
  const page = await pageRepo.findById(pageId);
  if (!page || page.deletedAt || page.workspaceId !== ctx.workspaceId) {
    throw new NotFoundException('Page not found');
  }
  if (
    ctx.spaceScope === 'selected' &&
    !ctx.allowedSpaceIds.includes(page.spaceId)
  ) {
    throw new ForbiddenException('Page space not in token scope');
  }
  return page;
}

function serializeVersion(version: any, opts?: { includeContent?: boolean }) {
  return {
    id: version.id,
    pageId: version.pageId,
    version: version.version,
    title: version.title,
    message: version.message,
    creatorId: version.creatorId,
    discarded: !!version.discardedAt,
    createdAt: version.createdAt,
    ...(opts?.includeContent ? { content: version.content } : {}),
  };
}

@Injectable()
export class ListPageVersionsTool {
  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pageVersionRepo: PageVersionRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'list_page_versions',
      description:
        'List the committed versions of a page (newest first). Each page starts at version 0 (creation marker); explicit commits create version 1, 2, ... The primary version is what readers and public links see.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'Page UUID or slug ID' },
          limit: {
            type: 'number',
            description: 'Max versions to return (default 20)',
          },
        },
        required: ['pageId'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const pageId = normalizePageId(args.pageId);
    const page = await assertPageAccess(this.pageRepo, pageId, ctx);

    const result = await this.pageVersionRepo.findVersionsByPageId(page.id, {
      limit: Math.min(Number(args.limit) || 20, 100),
      cursor: undefined,
      beforeCursor: undefined,
    } as any);

    return {
      pageId: page.id,
      primaryVersionId: page.primaryVersionId,
      versions: result.items.map((v) => serializeVersion(v)),
    };
  }
}

@Injectable()
export class GetPageVersionTool {
  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pageVersionRepo: PageVersionRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'get_page_version',
      description:
        'Fetch a committed page version snapshot including its content (ProseMirror JSON). Useful for comparing versions or reading what readers/public links currently see.',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'string', description: 'Version UUID' },
        },
        required: ['versionId'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const version = await this.pageVersionRepo.findById(args.versionId, {
      includeContent: true,
    });
    if (!version) {
      throw new NotFoundException('Version not found');
    }
    await assertPageAccess(this.pageRepo, version.pageId, ctx);

    return serializeVersion(version, { includeContent: true });
  }
}

@Injectable()
export class CommitPageVersionTool {
  constructor(
    private readonly pageRepo: PageRepo,
    private readonly userRepo: UserRepo,
    private readonly pageVersionService: PageVersionService,
  ) {}

  asTool(): McpTool {
    return {
      name: 'commit_page_version',
      description:
        'Commit (문서확정) the current working doc of a page as a new version. The new version automatically becomes primary — readers and latest-following public links see it immediately. Fails when there are no changes against the current primary version. Provide a concise commit message describing what changed.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'Page UUID or slug ID' },
          message: {
            type: 'string',
            description: 'Commit message describing the change',
          },
        },
        required: ['pageId', 'message'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const pageId = normalizePageId(args.pageId);
    const page = await assertPageAccess(this.pageRepo, pageId, ctx);

    const user = await this.userRepo.findById(ctx.userId, ctx.workspaceId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const version = await this.pageVersionService.commit(
      page,
      { message: String(args.message) },
      user,
    );

    return {
      committed: true,
      ...serializeVersion(version),
      primary: true,
    };
  }
}
