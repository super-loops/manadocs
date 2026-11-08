import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { PageVersionRepo } from '@manadocs/db/repos/page/page-version.repo';
import { UserRepo } from '@manadocs/db/repos/user/user.repo';
import { CollaborationGateway } from '../../../collaboration/collaboration.gateway';
import {
  htmlToJson,
  pageDocumentName,
} from '../../../collaboration/collaboration.util';
import { markdownToHtml } from '@manadocs/editor-ext';
import { McpCallContext, McpTool } from '../mcp.types';
import {
  docContainsAutoNodes,
  expandAutoNodes,
} from '../utils/expand-auto-nodes';
import { normalizePageId } from '../utils/identifiers';
import {
  ComponentError,
  ComponentService,
} from '../../component/component.service';
import {
  ComponentInstanceAttrs,
  containsInstanceNodes,
  resolveInstanceNodes,
} from '../../component/component-instance.util';

type PatchOp = {
  op:
    | 'replace'
    | 'insertAfter'
    | 'insertBefore'
    | 'delete'
    | 'appendToEnd'
    | 'prependToStart';
  blockId?: string;
  blockIndex?: number;
  content?: any;
  format?: 'markdown' | 'html' | 'json';
};

@Injectable()
export class PatchPageBlocksTool {
  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pageVersionRepo: PageVersionRepo,
    private readonly userRepo: UserRepo,
    private readonly collaborationGateway: CollaborationGateway,
    private readonly componentService: ComponentService,
  ) {}

  asTool(): McpTool {
    return {
      name: 'patch_page_blocks',
      description:
        'Apply block-level edits to a page. Targeted ops (replace, insertAfter, insertBefore, delete) require blockId (from search_in_page, preferred) or blockIndex. Untargeted ops (appendToEnd, prependToStart) add content at the page boundary and do not need a target. content accepts markdown, html, or json (with auto/autoInline nodes, and componentInstance nodes for images/files: {\"type\":\"componentInstance\",\"attrs\":{\"component\":\"<slug>\"}}). All ops are applied in order within one Yjs transaction.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'Page UUID or slug ID' },
          operations: {
            type: 'array',
            description: 'Ordered list of block operations',
            items: {
              type: 'object',
              properties: {
                op: {
                  type: 'string',
                  enum: [
                    'replace',
                    'insertAfter',
                    'insertBefore',
                    'delete',
                    'appendToEnd',
                    'prependToStart',
                  ],
                },
                blockId: { type: 'string' },
                blockIndex: { type: 'integer', minimum: 0 },
                content: {
                  description:
                    'New block content (required for replace/insert*)',
                },
                format: {
                  type: 'string',
                  enum: ['markdown', 'html', 'json'],
                  description: 'Default markdown',
                },
              },
              required: ['op'],
              additionalProperties: false,
            },
          },
        },
        required: ['pageId', 'operations'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const pageId = normalizePageId(args.pageId);
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }
    if (page.workspaceId !== ctx.workspaceId) {
      throw new NotFoundException('Page not found');
    }
    if (
      ctx.spaceScope === 'selected' &&
      !ctx.allowedSpaceIds.includes(page.spaceId)
    ) {
      throw new ForbiddenException('Page space not in token scope');
    }

    const user = await this.userRepo.findById(ctx.userId, ctx.workspaceId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ops: PatchOp[] = Array.isArray(args.operations)
      ? args.operations
      : [];
    if (ops.length === 0) {
      throw new BadRequestException('operations is required');
    }

    const instances: ComponentInstanceAttrs[] = [];
    const resolved: Array<{
      op: PatchOp['op'];
      blockId?: string | null;
      blockIndex?: number | null;
      nodes?: any[];
    }> = [];

    for (const op of ops) {
      if (!op.op) {
        throw new BadRequestException('op is required');
      }
      const isUntargeted =
        op.op === 'appendToEnd' || op.op === 'prependToStart';
      if (!isUntargeted && !op.blockId && op.blockIndex === undefined) {
        throw new BadRequestException(
          `${op.op} must specify blockId or blockIndex`,
        );
      }
      const base = {
        op: op.op,
        blockId: op.blockId ?? null,
        blockIndex: op.blockIndex ?? null,
      };
      if (op.op === 'delete') {
        resolved.push(base);
        continue;
      }
      if (op.content === undefined || op.content === null) {
        throw new BadRequestException(`${op.op} requires content`);
      }
      const nodes = await this.parseNodes(
        op.content,
        op.format ?? 'markdown',
        page.spaceId,
        instances,
      );
      if (nodes.length === 0) {
        throw new BadRequestException('content produced no blocks');
      }
      resolved.push({ ...base, nodes });
    }

    // Primary 작업문서의 명시 room 으로 접속 (클라이언트와 동일 문서 보장)
    const workingDocId =
      await this.pageVersionRepo.resolvePrimaryWorkingDocId(page.id);
    await this.collaborationGateway.handleYjsEvent(
      'patchPageBlocks' as any,
      pageDocumentName(page.id, workingDocId),
      { operations: resolved, user } as any,
    );

    return {
      pageId: page.id,
      slugId: page.slugId,
      applied: resolved.length,
      ...(instances.length > 0
        ? {
            instances: instances.map((i) => ({
              component: i.slug,
              revision: i.revision,
              empty: i.revision === 0,
            })),
          }
        : {}),
    };
  }

  private async parseNodes(
    content: any,
    format: 'markdown' | 'html' | 'json',
    spaceId: string,
    instances: ComponentInstanceAttrs[],
  ): Promise<any[]> {
    let doc: any;
    switch (format) {
      case 'markdown': {
        const html = (await markdownToHtml(String(content))) as string;
        doc = htmlToJson(html);
        break;
      }
      case 'html': {
        doc = htmlToJson(String(content));
        break;
      }
      case 'json':
      default: {
        // Accept either full doc, content array, or a single node.
        if (Array.isArray(content)) {
          doc = { type: 'doc', content };
        } else if (content?.type === 'doc') {
          doc = content;
        } else if (content?.type) {
          doc = { type: 'doc', content: [content] };
        } else {
          doc = content;
        }
        break;
      }
    }

    if (docContainsAutoNodes(doc)) {
      doc = await expandAutoNodes(doc);
    }

    if (containsInstanceNodes(doc)) {
      try {
        const out = await resolveInstanceNodes(doc, (ref) =>
          this.componentService.findByRef(spaceId, ref),
        );
        doc = out.content;
        instances.push(...out.instances);
      } catch (err: any) {
        throw new ComponentError(err.code ?? 'COMPONENT_ERROR', err.message, {}, 400);
      }
    }

    return Array.isArray(doc?.content) ? doc.content : [];
  }
}
