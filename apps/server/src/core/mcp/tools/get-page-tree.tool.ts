import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { SpaceRepo } from '@manadocs/db/repos/space/space.repo';
import { McpCallContext, McpTool } from '../mcp.types';
import { normalizePageId } from '../utils/identifiers';

type TreeNode = {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  position: string;
  blockCount: number;
  parentPageId: string | null;
  children?: TreeNode[];
  hasChildren?: boolean;
};

@Injectable()
export class GetPageTreeTool {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageRepo: PageRepo,
    private readonly spaceRepo: SpaceRepo,
  ) {}

  asTool(): McpTool {
    return {
      name: 'get_page_tree',
      description:
        'Get the page hierarchy of a space or subtree. Returns nested tree with title, icon, position, and blockCount (no content). Use this to navigate structure, plan page moves, or generate an outline of a section.',
      inputSchema: {
        type: 'object',
        properties: {
          spaceId: {
            type: 'string',
            description:
              'Space UUID (required unless pageId is given, then derived from the page)',
          },
          pageId: {
            type: 'string',
            description:
              'Optional page UUID or slug ID to use as the subtree root. When omitted, returns the full space tree from root pages.',
          },
          maxDepth: {
            type: 'integer',
            description:
              'Maximum depth from the root level (default 4). Nodes beyond this depth are truncated with hasChildren: true.',
            minimum: 1,
            maximum: 20,
          },
          includeSpaceDetail: {
            type: 'boolean',
            description:
              'Include space description and authoringRules in the response (default true). Set false after the first call to save tokens.',
          },
        },
        additionalProperties: false,
      },
      handler: (args, ctx) => this.handle(args, ctx),
    };
  }

  private async handle(args: Record<string, any>, ctx: McpCallContext) {
    const maxDepth = Math.min(
      Math.max(Number(args.maxDepth) || 4, 1),
      20,
    );

    let spaceId: string;
    let rootId: string | null = null;
    let spaceRecord: any = null;

    if (args.pageId) {
      const page = await this.pageRepo.findById(normalizePageId(args.pageId));
      if (!page || page.deletedAt) {
        throw new NotFoundException('Page not found');
      }
      if (page.workspaceId !== ctx.workspaceId) {
        throw new NotFoundException('Page not found');
      }
      spaceId = page.spaceId;
      rootId = page.id;
    } else {
      if (!args.spaceId) {
        throw new NotFoundException('spaceId or pageId is required');
      }
      // Accept UUID or space slug
      const space = await this.spaceRepo.findById(
        String(args.spaceId),
        ctx.workspaceId,
      );
      if (!space) {
        throw new NotFoundException('Space not found');
      }
      spaceId = space.id;
      spaceRecord = space;
    }

    if (
      ctx.spaceScope === 'selected' &&
      !ctx.allowedSpaceIds.includes(spaceId)
    ) {
      throw new ForbiddenException('Space not in token scope');
    }

    // Fetch all non-deleted pages in the space with blockCount computed in SQL.
    const rows = await this.db
      .selectFrom('pages')
      .select([
        'id',
        'slugId',
        'title',
        'icon',
        'position',
        'parentPageId',
        sql<number>`COALESCE(jsonb_array_length(content->'content'), 0)`.as(
          'blockCount',
        ),
      ])
      .where('spaceId', '=', spaceId)
      .where('deletedAt', 'is', null)
      .execute();

    // Build index: parentId -> sorted children
    const byParent = new Map<string | null, TreeNode[]>();
    for (const r of rows) {
      const node: TreeNode = {
        id: r.id,
        slugId: r.slugId,
        title: r.title,
        icon: r.icon,
        position: r.position,
        blockCount: Number(r.blockCount) || 0,
        parentPageId: r.parentPageId,
      };
      const key = r.parentPageId;
      const arr = byParent.get(key);
      if (arr) arr.push(node);
      else byParent.set(key, [node]);
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) =>
        a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
      );
    }

    const build = (parentId: string | null, depth: number): TreeNode[] => {
      const children = byParent.get(parentId) ?? [];
      return children.map((node) => {
        const kids = byParent.get(node.id) ?? [];
        if (kids.length === 0) return node;
        if (depth >= maxDepth) {
          return { ...node, hasChildren: true };
        }
        return { ...node, children: build(node.id, depth + 1) };
      });
    };

    let nodes: TreeNode[];
    if (rootId) {
      // Include the root page itself as the single top-level entry.
      const rootRow = rows.find((r) => r.id === rootId);
      if (!rootRow) {
        nodes = [];
      } else {
        const rootNode: TreeNode = {
          id: rootRow.id,
          slugId: rootRow.slugId,
          title: rootRow.title,
          icon: rootRow.icon,
          position: rootRow.position,
          blockCount: Number(rootRow.blockCount) || 0,
          parentPageId: rootRow.parentPageId,
        };
        const kids = byParent.get(rootId) ?? [];
        if (kids.length > 0) {
          rootNode.children = build(rootId, 2);
        }
        nodes = [rootNode];
      }
    } else {
      nodes = build(null, 1);
    }

    const includeDetail = args.includeSpaceDetail !== false;
    const result: Record<string, any> = {
      spaceId,
      rootPageId: rootId,
      totalPages: rows.length,
      maxDepth,
      nodes,
    };

    if (includeDetail) {
      // Fetch space record if not already loaded (pageId path)
      if (!spaceRecord) {
        spaceRecord = await this.spaceRepo.findById(spaceId, ctx.workspaceId);
      }
      if (spaceRecord) {
        result.spaceName = spaceRecord.name;
        result.spaceDescription = spaceRecord.description;
        result.authoringRules = spaceRecord.authoringRules;
      }
    }

    return result;
  }
}
