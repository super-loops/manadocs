import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateShareDto, ShareInfoDto, UpdateShareDto } from './dto/share.dto';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import { nanoIdGen } from '../../common/helpers';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { TokenService } from '../auth/services/token.service';
import { jsonToNode } from '../../collaboration/collaboration.util';
import {
  getAttachmentIds,
  getProsemirrorContent,
  isAttachmentNode,
} from '../../common/helpers/prosemirror/utils';
import { Node } from '@tiptap/pm/model';
import { ShareRepo } from '@manadocs/db/repos/share/share.repo';
import { PagePermissionRepo } from '@manadocs/db/repos/page/page-permission.repo';
import { PageVersionRepo } from '@manadocs/db/repos/page/page-version.repo';
import { updateAttachmentAttr } from './share.util';
import { Page } from '@manadocs/db/types/entity.types';
import { validate as isValidUUID } from 'uuid';
import { sql } from 'kysely';

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(
    private readonly shareRepo: ShareRepo,
    private readonly pageRepo: PageRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly pageVersionRepo: PageVersionRepo,
    @InjectKysely() private readonly db: KyselyDB,
    private readonly tokenService: TokenService,
  ) {}

  async getShareTree(shareId: string, workspaceId: string) {
    const share = await this.shareRepo.findById(shareId);
    if (!share || share.workspaceId !== workspaceId) {
      throw new NotFoundException('Share not found');
    }

    const isRestricted =
      await this.pagePermissionRepo.hasRestrictedAncestor(share.pageId);
    if (isRestricted) {
      throw new NotFoundException('Share not found');
    }

    if (share.includeSubPages) {
      const pageTree =
        await this.pageRepo.getPageAndDescendantsExcludingRestricted(
          share.pageId,
          { includeContent: false },
        );

      return { share, pageTree };
    } else {
      return { share, pageTree: [] };
    }
  }

  async createShare(opts: {
    authUserId: string;
    workspaceId: string;
    page: Page;
    createShareDto: CreateShareDto;
  }) {
    const { authUserId, workspaceId, page, createShareDto } = opts;

    // D2 — 확정 버전이 없는 페이지는 외부 공유 불가
    if (!page.primaryVersionId) {
      throw new BadRequestException(
        'This page has no committed version yet. Commit the page before sharing.',
      );
    }

    const versionMode = createShareDto.versionMode ?? 'primary';
    let fixedVersionId: string | null = null;

    if (versionMode === 'fixed') {
      fixedVersionId = createShareDto.fixedVersionId ?? page.primaryVersionId;
      const version = await this.pageVersionRepo.findById(fixedVersionId);
      if (!version || version.pageId !== page.id) {
        throw new BadRequestException('Fixed version not found for this page');
      }
      if (version.version === 0) {
        throw new BadRequestException('Cannot pin the creation marker');
      }
      if (version.discardedAt) {
        throw new BadRequestException('Cannot pin a discarded version');
      }
    }

    try {
      return await this.shareRepo.insertShare({
        key: nanoIdGen().toLowerCase(),
        pageId: page.id,
        includeSubPages: createShareDto.includeSubPages ?? false,
        searchIndexing: createShareDto.searchIndexing ?? false,
        versionMode,
        fixedVersionId,
        onDiscard: createShareDto.onDiscard ?? 'fallback',
        creatorId: authUserId,
        spaceId: page.spaceId,
        workspaceId,
      });
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException('Failed to share page');
    }
  }

  async listSharesForPage(pageId: string) {
    return this.shareRepo.findAllByPageId(pageId, { includeCreator: true });
  }

  async updateShare(shareId: string, updateShareDto: UpdateShareDto) {
    try {
      return this.shareRepo.updateShare(
        {
          includeSubPages: updateShareDto.includeSubPages,
          searchIndexing: updateShareDto.searchIndexing,
          ...(updateShareDto.onDiscard
            ? { onDiscard: updateShareDto.onDiscard }
            : {}),
        },
        shareId,
      );
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException('Failed to update share');
    }
  }

  async getSharedPage(dto: ShareInfoDto, workspaceId: string) {
    // shareId(key)가 오면 그 링크의 버전 모드로, 아니면 페이지를 덮는
    // 공유를 CTE 로 탐색(레거시 경로)해 해석한다.
    let share: any = null;

    if (dto.shareId) {
      const shareRow = await this.shareRepo.findById(dto.shareId);
      if (!shareRow || shareRow.workspaceId !== workspaceId) {
        throw new NotFoundException('Shared page not found');
      }
      share = shareRow;
    } else {
      share = await this.getShareForPage(dto.pageId, workspaceId);
    }

    if (!share) {
      throw new NotFoundException('Shared page not found');
    }

    const targetPageId = dto.pageId ?? share.pageId;

    const page = await this.pageRepo.findById(targetPageId, {
      includeContent: true,
      includeCreator: true,
    });

    if (!page || page.deletedAt) {
      throw new NotFoundException('Shared page not found');
    }

    // 명시 share 로 온 경우 커버리지 검증 — 공유 페이지 본인 또는
    // includeSubPages 일 때 그 하위 페이지만 허용
    if (dto.shareId && page.id !== share.pageId) {
      if (!share.includeSubPages) {
        throw new NotFoundException('Shared page not found');
      }
      const isDescendant = await this.isDescendantOf(page.id, share.pageId);
      if (!isDescendant) {
        throw new NotFoundException('Shared page not found');
      }
    }

    // Block access to restricted pages
    const isRestricted =
      await this.pagePermissionRepo.hasRestrictedAncestor(page.id);
    if (isRestricted) {
      throw new NotFoundException('Shared page not found');
    }

    // ── 버전 해석 — 공유는 항상 확정본(committed)만 서빙 ──────────
    const resolved = await this.resolveSharedVersion(share, page);

    page.content = resolved.content;
    page.content = await this.updatePublicAttachments(page);

    return { page, share, versionInfo: resolved.versionInfo };
  }

  /**
   * 공유 링크의 버전 모드에 따라 서빙할 확정본을 고른다.
   * - primary: 페이지의 현재 Primary 버전 (없으면 404)
   * - fixed: 고정 버전. 폐기 시 onDiscard 정책(D3):
   *   fallback → 가장 가까운 비폐기 버전 + 안내 플래그, 404 → 명시적 차단
   * 공유 대상의 하위 페이지(includeSubPages)는 항상 자기 Primary 버전.
   */
  private async resolveSharedVersion(share: any, page: Page) {
    const isPinnedPage = share.pageId === page.id;

    if (
      isPinnedPage &&
      share.versionMode === 'fixed' &&
      share.fixedVersionId
    ) {
      const fixed = await this.pageVersionRepo.findById(share.fixedVersionId, {
        includeContent: true,
      });

      if (fixed && fixed.pageId === page.id && !fixed.discardedAt) {
        return {
          content: fixed.content,
          versionInfo: {
            mode: 'fixed',
            version: fixed.version,
            versionId: fixed.id,
            fallback: false,
          },
        };
      }

      // 고정 버전이 폐기(또는 소실)됨 — onDiscard 정책 분기
      if (share.onDiscard === '404') {
        throw new NotFoundException('Shared page not found');
      }

      const fallback = await this.pageVersionRepo.findNearestActiveVersion(
        page.id,
        fixed?.version ?? 0,
        { includeContent: true },
      );

      if (!fallback) {
        throw new NotFoundException('Shared page not found');
      }

      return {
        content: fallback.content,
        versionInfo: {
          mode: 'fixed',
          version: fallback.version,
          versionId: fallback.id,
          fallback: true,
        },
      };
    }

    // primary 모드 (및 하위 페이지)
    if (!page.primaryVersionId) {
      throw new NotFoundException('Shared page not found');
    }

    const primary = await this.pageVersionRepo.findById(page.primaryVersionId, {
      includeContent: true,
    });

    if (!primary) {
      throw new NotFoundException('Shared page not found');
    }

    return {
      content: primary.content,
      versionInfo: {
        mode: 'primary',
        version: primary.version,
        versionId: primary.id,
        fallback: false,
      },
    };
  }

  private async isDescendantOf(
    pageId: string,
    ancestorPageId: string,
  ): Promise<boolean> {
    const result = await this.db
      .withRecursive('ancestors', (cte) =>
        cte
          .selectFrom('pages')
          .select(['id', 'parentPageId'])
          .where('id', '=', pageId)
          .unionAll((union) =>
            union
              .selectFrom('pages as p')
              .innerJoin('ancestors as a', 'a.parentPageId', 'p.id')
              .select(['p.id', 'p.parentPageId']),
          ),
      )
      .selectFrom('ancestors')
      .select('id')
      .where('id', '=', ancestorPageId)
      .executeTakeFirst();

    return !!result;
  }

  async getShareForPage(pageId: string, workspaceId: string) {
    // here we try to check if a page was shared directly or if it inherits the share from its closest shared ancestor
    const share = await this.db
      .withRecursive('page_hierarchy', (cte) =>
        cte
          .selectFrom('pages')
          .leftJoin('shares', 'shares.pageId', 'pages.id')
          .select([
            'pages.id',
            'pages.slugId',
            'pages.title',
            'pages.icon',
            'pages.parentPageId',
            sql`0`.as('level'),
            'shares.id as shareId',
            'shares.key as shareKey',
            'shares.includeSubPages',
            'shares.searchIndexing',
            'shares.creatorId',
            'shares.spaceId',
            'shares.workspaceId',
            'shares.createdAt',
          ])
          .where(isValidUUID(pageId) ? 'pages.id' : 'pages.slugId', '=', pageId)
          .where('pages.deletedAt', 'is', null)
          .unionAll(
            (union) =>
              union
                .selectFrom('pages as p')
                .innerJoin('page_hierarchy as ph', 'ph.parentPageId', 'p.id')
                .leftJoin('shares as s', 's.pageId', 'p.id')
                .select([
                  'p.id',
                  'p.slugId',
                  'p.title',
                  'p.icon',
                  'p.parentPageId',
                  sql`ph.level + 1`.as('level'),
                  's.id as shareId',
                  's.key as shareKey',
                  's.includeSubPages',
                  's.searchIndexing',
                  's.creatorId',
                  's.spaceId',
                  's.workspaceId',
                  's.createdAt',
                ])
                .where('p.deletedAt', 'is', null)
                .where(sql`ph.share_id`, 'is', null) // stop if share found
                .where(sql`ph.level`, '<', sql`25`), // prevent loop
          ),
      )
      .selectFrom('page_hierarchy')
      .selectAll()
      .where('shareId', 'is not', null)
      .limit(1)
      .executeTakeFirst();

    if (!share || share.workspaceId !== workspaceId) {
      return undefined;
    }

    if ((share.level as number) > 0 && !share.includeSubPages) {
      return undefined;
    }

    return {
      id: share.shareId,
      key: share.shareKey,
      includeSubPages: share.includeSubPages,
      searchIndexing: share.searchIndexing,
      pageId: share.id,
      creatorId: share.creatorId,
      spaceId: share.spaceId,
      workspaceId: share.workspaceId,
      createdAt: share.createdAt,
      level: share.level,
      sharedPage: {
        id: share.id,
        slugId: share.slugId,
        title: share.title,
        icon: share.icon,
      },
    };
  }

  async getShareAncestorPage(
    ancestorPageId: string,
    childPageId: string,
  ): Promise<any> {
    let ancestor = null;
    try {
      ancestor = await this.db
        .withRecursive('page_ancestors', (db) =>
          db
            .selectFrom('pages')
            .select([
              'id',
              'slugId',
              'title',
              'parentPageId',
              'spaceId',
              (eb) =>
                eb
                  .case()
                  .when(eb.ref('id'), '=', ancestorPageId)
                  .then(true)
                  .else(false)
                  .end()
                  .as('found'),
            ])
            .where(isValidUUID(childPageId) ? 'id' : 'slugId', '=', childPageId)
            .unionAll((exp) =>
              exp
                .selectFrom('pages as p')
                .select([
                  'p.id',
                  'p.slugId',
                  'p.title',
                  'p.parentPageId',
                  'p.spaceId',
                  (eb) =>
                    eb
                      .case()
                      .when(eb.ref('p.id'), '=', ancestorPageId)
                      .then(true)
                      .else(false)
                      .end()
                      .as('found'),
                ])
                .innerJoin('page_ancestors as pa', 'pa.parentPageId', 'p.id')
                // Continue recursing only when the target ancestor hasn't been found on that branch.
                .where('pa.found', '=', false),
            ),
        )
        .selectFrom('page_ancestors')
        .selectAll()
        .where('found', '=', true)
        .limit(1)
        .executeTakeFirst();
    } catch (err) {
      // empty
    }

    return ancestor;
  }

  async isSharingAllowed(
    workspaceId: string,
    spaceId: string,
  ): Promise<boolean> {
    const result = await this.db
      .selectFrom('workspaces')
      .innerJoin('spaces', 'spaces.workspaceId', 'workspaces.id')
      .select([
        'workspaces.settings as workspaceSettings',
        'spaces.settings as spaceSettings',
      ])
      .where('workspaces.id', '=', workspaceId)
      .where('spaces.id', '=', spaceId)
      .executeTakeFirst();

    if (!result) return false;

    const workspaceDisabled =
      (result.workspaceSettings as any)?.sharing?.disabled === true;
    const spaceDisabled =
      (result.spaceSettings as any)?.sharing?.disabled === true;

    return !workspaceDisabled && !spaceDisabled;
  }

  async updatePublicAttachments(page: Page): Promise<any> {
    const prosemirrorJson = getProsemirrorContent(page.content);
    const attachmentIds = getAttachmentIds(prosemirrorJson);
    const attachmentMap = new Map<string, string>();

    await Promise.all(
      attachmentIds.map(async (attachmentId: string) => {
        const token = await this.tokenService.generateAttachmentToken({
          attachmentId,
          pageId: page.id,
          workspaceId: page.workspaceId,
        });
        attachmentMap.set(attachmentId, token);
      }),
    );

    const doc = jsonToNode(prosemirrorJson);

    doc?.descendants((node: Node) => {
      if (!isAttachmentNode(node.type.name)) return;

      const attachmentId = node.attrs.attachmentId;
      const token = attachmentMap.get(attachmentId);
      if (!token) return;

      updateAttachmentAttr(node, 'src', token);
      updateAttachmentAttr(node, 'url', token);
    });

    return doc.toJSON();
  }
}
