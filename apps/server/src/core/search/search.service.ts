import { Injectable } from '@nestjs/common';
import { SearchDTO, SearchSuggestionDTO } from './dto/search.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import { sql } from 'kysely';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@manadocs/db/repos/space/space-member.repo';
import { ShareRepo } from '@manadocs/db/repos/share/share.repo';
import { PagePermissionRepo } from '@manadocs/db/repos/page/page-permission.repo';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsquery = require('pg-tsquery')();

@Injectable()
export class SearchService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private pageRepo: PageRepo,
    private shareRepo: ShareRepo,
    private spaceMemberRepo: SpaceMemberRepo,
    private pagePermissionRepo: PagePermissionRepo,
  ) {}

  async searchPage(
    searchParams: SearchDTO,
    opts: {
      userId?: string;
      workspaceId: string;
    },
  ): Promise<{ items: SearchResponseDto[] }> {
    const { query } = searchParams;

    if (query.length < 1) {
      return { items: [] };
    }
    const searchQuery = tsquery(query.trim() + '*');

    // D10 — 기본은 확정본(committed) 인덱스만. includeWorking 이면 인증
    // 사용자의 편집 가능 스페이스에 한해 작업문서 인덱스를 OR 로 합친다.
    // 공유(share) 검색은 항상 확정본만.
    const includeWorking =
      Boolean(searchParams.includeWorking) &&
      Boolean(opts.userId) &&
      !searchParams.shareId;

    const editableSpaceIds = () =>
      this.getUserEditableSpaceIdsQuery(opts.userId);

    let queryResults = this.db
      .selectFrom('pages')
      .select([
        'id',
        'slugId',
        'title',
        'icon',
        'parentPageId',
        'creatorId',
        'createdAt',
        'updatedAt',
      ])
      .$if(!includeWorking, (qb) =>
        qb.select([
          sql<number>`ts_rank(committed_tsv, to_tsquery('english', f_unaccent(${searchQuery})))`.as(
            'rank',
          ),
          sql<string>`ts_headline('english', committed_text_content, to_tsquery('english', f_unaccent(${searchQuery})),'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
            'highlight',
          ),
        ]),
      )
      .$if(includeWorking, (qb) =>
        qb.select([
          sql<number>`greatest(
            coalesce(ts_rank(committed_tsv, to_tsquery('english', f_unaccent(${searchQuery}))), 0),
            CASE WHEN space_id IN (${editableSpaceIds()})
              THEN coalesce(ts_rank(tsv, to_tsquery('english', f_unaccent(${searchQuery}))), 0)
              ELSE 0 END
          )`.as('rank'),
          sql<string>`CASE WHEN space_id IN (${editableSpaceIds()})
            THEN ts_headline('english', text_content, to_tsquery('english', f_unaccent(${searchQuery})),'MinWords=9, MaxWords=10, MaxFragments=3')
            ELSE ts_headline('english', committed_text_content, to_tsquery('english', f_unaccent(${searchQuery})),'MinWords=9, MaxWords=10, MaxFragments=3')
            END`.as('highlight'),
        ]),
      )
      .$if(!includeWorking, (qb) =>
        qb.where(
          'committedTsv',
          '@@',
          sql<string>`to_tsquery('english', f_unaccent(${searchQuery}))`,
        ),
      )
      .$if(includeWorking, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb(
              'committedTsv',
              '@@',
              sql<string>`to_tsquery('english', f_unaccent(${searchQuery}))`,
            ),
            eb.and([
              eb('spaceId', 'in', editableSpaceIds()),
              eb(
                'tsv',
                '@@',
                sql<string>`to_tsquery('english', f_unaccent(${searchQuery}))`,
              ),
            ]),
          ]),
        ),
      )
      .$if(Boolean(searchParams.creatorId), (qb) =>
        qb.where('creatorId', '=', searchParams.creatorId),
      )
      .where('deletedAt', 'is', null)
      .orderBy('rank', 'desc')
      .limit(searchParams.limit || 25)
      .offset(searchParams.offset || 0);

    if (!searchParams.shareId) {
      queryResults = queryResults.select((eb) => this.pageRepo.withSpace(eb));
    }

    if (searchParams.spaceId) {
      // search by spaceId
      queryResults = queryResults.where('spaceId', '=', searchParams.spaceId);
    } else if (opts.userId && !searchParams.spaceId) {
      // only search spaces the user is a member of
      queryResults = queryResults
        .where(
          'spaceId',
          'in',
          this.spaceMemberRepo.getUserSpaceIdsQuery(opts.userId),
        )
        .where('workspaceId', '=', opts.workspaceId);
    } else if (searchParams.shareId && !searchParams.spaceId && !opts.userId) {
      // search in shares
      const shareId = searchParams.shareId;
      const share = await this.shareRepo.findById(shareId);
      if (!share || share.workspaceId !== opts.workspaceId) {
        return { items: [] };
      }

      const isRestricted =
        await this.pagePermissionRepo.hasRestrictedAncestor(share.pageId);
      if (isRestricted) {
        return { items: [] };
      }

      const pageIdsToSearch = [];
      if (share.includeSubPages) {
        const pageList = await this.pageRepo.getPageAndDescendantsExcludingRestricted(
          share.pageId,
          {
            includeContent: false,
          },
        );

        pageIdsToSearch.push(...pageList.map((page) => page.id));
      } else {
        pageIdsToSearch.push(share.pageId);
      }

      if (pageIdsToSearch.length > 0) {
        queryResults = queryResults
          .where('id', 'in', pageIdsToSearch)
          .where('workspaceId', '=', opts.workspaceId);
      } else {
        return { items: [] };
      }
    } else {
      return { items: [] };
    }

    //@ts-ignore
    let results: any[] = await queryResults.execute();

    // Filter results by page-level permissions (if user is authenticated)
    if (opts.userId && results.length > 0) {
      const pageIds = results.map((r: any) => r.id);
      const accessibleIds =
        await this.pagePermissionRepo.filterAccessiblePageIds({
          pageIds,
          userId: opts.userId,
          spaceId: searchParams.spaceId,
        });
      const accessibleSet = new Set(accessibleIds);
      results = results.filter((r: any) => accessibleSet.has(r.id));
    }

    //@ts-ignore
    const searchResults = results.map((result: SearchResponseDto) => {
      if (result.highlight) {
        result.highlight = result.highlight
          .replace(/\r\n|\r|\n/g, ' ')
          .replace(/\s+/g, ' ');
      }
      return result;
    });

    return { items: searchResults };
  }

  /** 사용자가 편집 권한(admin/writer)을 가진 스페이스 id 서브쿼리 */
  private getUserEditableSpaceIdsQuery(userId: string) {
    return this.db
      .selectFrom('spaceMembers')
      .select('spaceId')
      .where('role', 'in', ['admin', 'writer'])
      .where((eb) =>
        eb.or([
          eb('userId', '=', userId),
          eb(
            'groupId',
            'in',
            this.db
              .selectFrom('groupUsers')
              .select('groupId')
              .where('userId', '=', userId),
          ),
        ]),
      );
  }

  async searchSuggestions(
    suggestion: SearchSuggestionDTO,
    userId: string,
    workspaceId: string,
  ) {
    let users = [];
    let groups = [];
    let pages = [];

    const limit = suggestion?.limit || 10;
    const query = suggestion.query.toLowerCase().trim();

    if (suggestion.includeUsers) {
      const userQuery = this.db
        .selectFrom('users')
        .select(['id', 'name', 'email', 'avatarUrl'])
        .where('workspaceId', '=', workspaceId)
        .where('deletedAt', 'is', null)
        .where((eb) =>
          eb.or([
            eb(
              sql`LOWER(f_unaccent(users.name))`,
              'like',
              sql`LOWER(f_unaccent(${`%${query}%`}))`,
            ),
            eb(sql`users.email`, 'ilike', sql`f_unaccent(${`%${query}%`})`),
          ]),
        )
        .limit(limit);

      users = await userQuery.execute();
    }

    if (suggestion.includeGroups) {
      groups = await this.db
        .selectFrom('groups')
        .select(['id', 'name', 'description'])
        .where((eb) =>
          eb(
            sql`LOWER(f_unaccent(groups.name))`,
            'like',
            sql`LOWER(f_unaccent(${`%${query}%`}))`,
          ),
        )
        .where('workspaceId', '=', workspaceId)
        .limit(limit)
        .execute();
    }

    if (suggestion.includePages) {
      let pageSearch = this.db
        .selectFrom('pages')
        .select(['id', 'slugId', 'title', 'icon', 'spaceId'])
        .select((eb) => this.pageRepo.withSpace(eb))
        .where((eb) =>
          eb(
            sql`LOWER(f_unaccent(pages.title))`,
            'like',
            sql`LOWER(f_unaccent(${`%${query}%`}))`,
          ),
        )
        .where('deletedAt', 'is', null)
        .where('workspaceId', '=', workspaceId)
        .limit(limit);

      // search all spaces the user has access to, prioritizing the current space
      const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

      if (userSpaceIds?.length > 0) {
        pageSearch = pageSearch.where('spaceId', 'in', userSpaceIds);

        if (suggestion?.spaceId) {
          pageSearch = pageSearch.orderBy(
            sql`CASE WHEN pages."space_id" = ${suggestion.spaceId} THEN 0 ELSE 1 END`,
            'asc',
          );
        }

        pages = await pageSearch.execute();
      }

      // Filter by page-level permissions
      if (pages.length > 0) {
        const pageIds = pages.map((p) => p.id);
        const accessibleIds =
          await this.pagePermissionRepo.filterAccessiblePageIds({
            pageIds,
            userId,
          });
        const accessibleSet = new Set(accessibleIds);
        pages = pages.filter((p) => accessibleSet.has(p.id));
      }
    }

    return { users, groups, pages };
  }
}
