import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bytes from 'bytes';
import { SpaceRepo } from '@manadocs/db/repos/space/space.repo';
import { UserRepo } from '@manadocs/db/repos/user/user.repo';
import { ComponentRepo } from '@manadocs/db/repos/component/component.repo';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import {
  ComponentError,
  ComponentService,
  toComponentDto,
  UPLOAD_TICKET_TTL_SEC,
} from '../../component/component.service';
import { McpCallContext, McpTool } from '../mcp.types';

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

/** 컴포넌트 MCP 도구가 함께 쓰는 스페이스·사용자 해석 */
@Injectable()
export class ComponentToolContext {
  constructor(
    private readonly spaceRepo: SpaceRepo,
    private readonly userRepo: UserRepo,
    private readonly componentService: ComponentService,
  ) {}

  async user(ctx: McpCallContext) {
    const user = await this.userRepo.findById(ctx.userId, ctx.workspaceId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async space(ctx: McpCallContext, spaceRef: unknown, need: 'read' | 'edit') {
    if (!spaceRef) throw new ComponentError('SPACE_REQUIRED', 'spaceId is required');
    const found = await this.spaceRepo.findById(String(spaceRef), ctx.workspaceId);
    if (!found) throw new NotFoundException('Space not found');
    if (ctx.spaceScope === 'selected' && !ctx.allowedSpaceIds.includes(found.id)) {
      throw new ForbiddenException('Space not in token scope');
    }
    const user = await this.user(ctx);
    const space = await this.componentService.resolveSpace(
      found.id,
      user,
      ctx.workspaceId,
      need,
    );
    return { space, user };
  }
}

function compact(c: ReturnType<typeof toComponentDto>) {
  return {
    id: c.id,
    slug: c.slug,
    kind: c.kind,
    description: c.description,
    collection: c.collectionName,
    currentRevision: c.currentRevision,
    empty: c.empty,
    fileName: c.fileName,
  };
}

@Injectable()
export class ListComponentsTool {
  constructor(
    private readonly tc: ComponentToolContext,
    private readonly componentService: ComponentService,
    private readonly componentRepo: ComponentRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'list_components',
      description:
        'List image/file components of a space (the asset library pages reference with componentInstance nodes), plus its collections. Filter by collection name, text query (slug/description), kind, or emptyOnly (components still waiting for a file).',
      inputSchema: {
        type: 'object',
        properties: {
          spaceId: { type: 'string', description: 'Space UUID or slug' },
          collection: { type: 'string', description: 'Collection name or id' },
          query: { type: 'string' },
          kind: { type: 'string', enum: ['image', 'file'] },
          emptyOnly: { type: 'boolean' },
        },
        required: ['spaceId'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const { space } = await this.tc.space(ctx, args.spaceId, 'read');
    const collections = await this.componentService.listCollections(space.id);
    let collectionId: string | undefined;
    if (args.collection) {
      const ref = String(args.collection).toLowerCase();
      const match = collections.find(
        (c) => c.id === args.collection || c.name.toLowerCase() === ref,
      );
      if (!match) {
        throw new ComponentError(
          'COLLECTION_NOT_FOUND',
          `Collection "${args.collection}" not found`,
          { collections: collections.map((c) => c.name) },
          404,
        );
      }
      collectionId = match.id;
    }
    const rows = await this.componentRepo.listComponents({
      spaceId: space.id,
      collectionId,
      query: args.query ? String(args.query) : undefined,
      kind: args.kind ? String(args.kind) : undefined,
      emptyOnly: !!args.emptyOnly,
      limit: 100,
    });
    return {
      spaceId: space.id,
      collections: collections.map((c) => ({
        id: c.id,
        name: c.name,
        components: c.componentCount,
      })),
      components: rows.map((r) => compact(toComponentDto(r))),
    };
  }
}

@Injectable()
export class GetComponentTool {
  constructor(
    private readonly tc: ComponentToolContext,
    private readonly componentService: ComponentService,
  ) {}

  asTool(): McpTool {
    return {
      name: 'get_component',
      description:
        'Get one component by slug or id: its revisions and the pages that use it (with approximate position and pinned revision).',
      inputSchema: {
        type: 'object',
        properties: {
          spaceId: { type: 'string' },
          component: { type: 'string', description: 'Component slug or id' },
        },
        required: ['spaceId', 'component'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const { space, user } = await this.tc.space(ctx, args.spaceId, 'read');
    const component = await this.componentService.findByRef(
      space.id,
      String(args.component ?? ''),
    );
    if (!component) {
      throw new ComponentError(
        'COMPONENT_NOT_FOUND',
        `Component "${args.component}" not found`,
        { hint: 'Use list_components to search, or create_component.' },
        404,
      );
    }
    const detail = await this.componentService.getDetail(
      component.id,
      user,
      ctx.workspaceId,
    );
    const usages = await this.componentService.getUsages(component);
    return {
      component: compact(detail.component),
      revisions: detail.revisions.map((r) => ({
        revision: r.revision,
        fileName: r.fileName,
        fileSize: r.fileSize,
        message: r.message,
        createdAt: r.createdAt,
      })),
      usedIn: usages.map((u) => ({
        pageId: u.pageId,
        slugId: u.slugId,
        title: u.title,
        instances: u.workingDocs
          .filter((w) => w.primary)
          .flatMap((w) =>
            w.locations.map((l) => ({
              revision: l.revision,
              blockIndex: l.blockIndex,
              heading: l.heading,
              position: `${Math.round(l.ratio * 100)}%`,
            })),
          ),
        committedRevisions: u.committed?.revisions ?? [],
      })),
    };
  }
}

@Injectable()
export class CreateComponentTool {
  constructor(
    private readonly tc: ComponentToolContext,
    private readonly componentService: ComponentService,
  ) {}

  asTool(): McpTool {
    return {
      name: 'create_component',
      description:
        'Create an image or file component in a space collection (the collection is created if missing). It starts EMPTY (revision 0) until a file is uploaded with upload_ticket. Fails with SLUG_TAKEN (and the existing component) if the slug is already used — reuse that one if it is the same asset.',
      inputSchema: {
        type: 'object',
        properties: {
          spaceId: { type: 'string' },
          collection: {
            type: 'string',
            description: 'Collection name (created if missing) or id',
          },
          slug: {
            type: 'string',
            description:
              'Unique in the space: lowercase letters, digits, ".", "_", "-" (e.g. "login-dashboard")',
          },
          kind: { type: 'string', enum: ['image', 'file'], default: 'image' },
          description: {
            type: 'string',
            description:
              'What this asset shows / should show. Shown on the empty placeholder so a person knows what to drop in.',
          },
        },
        required: ['spaceId', 'collection', 'slug', 'description'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const { space, user } = await this.tc.space(ctx, args.spaceId, 'edit');
    const created = await this.componentService.createComponent(space, user, {
      collection: String(args.collection ?? ''),
      slug: String(args.slug ?? ''),
      kind: args.kind ? String(args.kind) : 'image',
      description: args.description ? String(args.description) : null,
    });
    return {
      component: compact(created),
      next: `Insert {"type":"componentInstance","attrs":{"component":"${created.slug}"}} with patch_page_blocks (format json), then call upload_ticket to upload the file.`,
    };
  }
}

@Injectable()
export class UploadTicketTool {
  constructor(
    private readonly tc: ComponentToolContext,
    private readonly componentService: ComponentService,
    private readonly environmentService: EnvironmentService,
  ) {}

  asTool(): McpTool {
    return {
      name: 'upload_ticket',
      description:
        'Get a one-time upload URL for a component\'s next revision. Run the returned curl once (multipart POST of the file) — no token needed; the ticket is single-use, valid 10 minutes. Empty instances of the component fill automatically; pages pinned to an older revision get "update available".',
      inputSchema: {
        type: 'object',
        properties: {
          spaceId: { type: 'string' },
          component: { type: 'string', description: 'Component slug or id' },
          message: {
            type: 'string',
            description: 'Optional revision note (e.g. "dark mode capture")',
          },
        },
        required: ['spaceId', 'component'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const { space, user } = await this.tc.space(ctx, args.spaceId, 'edit');
    const component = await this.componentService.findByRef(
      space.id,
      String(args.component ?? ''),
    );
    if (!component) {
      throw new ComponentError(
        'COMPONENT_NOT_FOUND',
        `Component "${args.component}" not found`,
        { hint: 'Create it first with create_component.' },
        404,
      );
    }
    if (!ctx.apiTokenId) {
      throw new ComponentError('TOKEN_REQUIRED', 'MCP token context missing', {}, 401);
    }
    const { token, expiresAt } = await this.componentService.issueTicket({
      component,
      userId: user.id,
      apiTokenId: ctx.apiTokenId,
      workspaceId: ctx.workspaceId,
      message: args.message ? String(args.message) : null,
    });
    const appUrl = this.environmentService.getAppUrl().replace(/\/$/, '');
    const uploadUrl = `${appUrl}/api/mcp/uploads/${token}`;
    const limit = this.environmentService.getFileUploadSizeLimit();
    return {
      component: { slug: component.slug, kind: component.kind, currentRevision: component.currentRevision },
      upload_url: uploadUrl,
      method: 'POST',
      field: 'file',
      expires_in: UPLOAD_TICKET_TTL_SEC,
      expires_at: expiresAt.toISOString(),
      max_bytes: bytes(limit),
      accepted_extensions: component.kind === 'image' ? IMAGE_EXTS : 'any',
      curl: `curl -sS -X POST -F 'file=@<path-to-file>' '${uploadUrl}'`,
      responses: {
        '201': 'uploaded — new revision is live',
        '404': 'ticket not found',
        '410': 'ticket expired or already used — request a new one',
        '400': 'file problem (type/size) — the ticket stays valid, fix and retry',
      },
    };
  }
}
