import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PageService } from '../../page/services/page.service';
import { SpaceRepo } from '@manadocs/db/repos/space/space.repo';
import { McpCallContext, McpTool } from '../mcp.types';
import { normalizePageId } from '../utils/identifiers';
import {
  docContainsAutoNodes,
  expandAutoNodes,
} from '../utils/expand-auto-nodes';

@Injectable()
export class CreatePageTool {
  constructor(
    private readonly pageService: PageService,
    private readonly spaceRepo: SpaceRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'create_page',
      description:
        'Create a new page in a space. Content accepts markdown, html, or prosemirror JSON. JSON content may embed {type:"auto",text:"markdown..."} or {type:"autoInline",text:"inline **md**"} nodes which are expanded server-side.',
      inputSchema: {
        type: 'object',
        properties: {
          spaceId: { type: 'string', description: 'Space UUID' },
          title: { type: 'string' },
          content: {
            description: 'Page body content (string for markdown/html, object for json)',
          },
          format: {
            type: 'string',
            enum: ['markdown', 'html', 'json'],
            description: 'Content format (default: markdown)',
          },
          parentPageId: {
            type: 'string',
            description: 'Optional parent page UUID',
          },
          icon: { type: 'string', description: 'Optional icon emoji' },
        },
        required: ['spaceId'],
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const space = await this.spaceRepo.findById(
      String(args.spaceId),
      ctx.workspaceId,
    );
    if (!space) {
      throw new NotFoundException('Space not found');
    }
    const spaceId = space.id;
    if (
      ctx.spaceScope === 'selected' &&
      !ctx.allowedSpaceIds.includes(spaceId)
    ) {
      throw new ForbiddenException('Space not in token scope');
    }

    const format = (args.format as 'markdown' | 'html' | 'json') ?? 'markdown';
    let content = args.content;
    if (format === 'json' && content && docContainsAutoNodes(content)) {
      content = await expandAutoNodes(content);
    }

    const page = await this.pageService.create(ctx.userId, ctx.workspaceId, {
      spaceId,
      title: args.title ? String(args.title) : undefined,
      icon: args.icon ? String(args.icon) : undefined,
      parentPageId: args.parentPageId
        ? normalizePageId(args.parentPageId)
        : undefined,
      content,
      format,
    });

    return {
      id: page.id,
      slugId: page.slugId,
      title: page.title,
      spaceId: page.spaceId,
    };
  }
}
