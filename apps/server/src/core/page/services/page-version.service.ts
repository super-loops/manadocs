import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { isDeepStrictEqual } from 'node:util';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import { WsService } from '../../../ws/ws.service';

/** 직전 확정에 합칠 수 있는 시간 — 처음 확정한 시각부터 */
export const SQUASH_WINDOW_MS = 24 * 60 * 60 * 1000;
import { executeTx } from '@manadocs/db/utils';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { PageVersionRepo } from '@manadocs/db/repos/page/page-version.repo';
import { PageWorkingDocRepo } from '@manadocs/db/repos/page/page-working-doc.repo';
import { PageService } from './page.service';
import {
  Page,
  PageVersion,
  PageWorkingDoc,
  UpdatablePage,
  User,
} from '@manadocs/db/types/entity.types';
import { PaginationOptions } from '@manadocs/db/pagination/pagination-options';
import { CollaborationGateway } from '../../../collaboration/collaboration.gateway';
import {
  jsonToText,
  pageDocumentName,
} from '../../../collaboration/collaboration.util';
import { createYdocFromJson } from '../../../common/helpers/prosemirror/utils';
import { isSameDoc } from '../utils/diff-stats.util';

const EMPTY_DOC = { type: 'doc', content: [] };

@Injectable()
export class PageVersionService {
  private readonly logger = new Logger(PageVersionService.name);

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pageVersionRepo: PageVersionRepo,
    private readonly pageWorkingDocRepo: PageWorkingDocRepo,
    private readonly collaborationGateway: CollaborationGateway,
    private readonly pageService: PageService,
    @InjectKysely() private readonly db: KyselyDB,
    private readonly wsService: WsService,
  ) {}

  /**
   * 확정·폐기·Primary 변경을 열린 화면에 알린다 — 사이드바 «수정중», 버전 패널,
   * 페이지 정보(primaryVersionId)가 다른 사람·에이전트의 확정에도 곧바로 맞춰지게.
   * 클라이언트는 받은 키로 쿼리를 무효화만 한다(내용은 싣지 않는다).
   */
  private async notifyVersionChangeById(pageId: string) {
    const page = await this.pageRepo.findById(pageId).catch(() => null);
    if (page) this.notifyVersionChange(page);
  }

  private notifyVersionChange(page: { id: string; slugId?: string; spaceId: string }) {
    const base = { operation: 'invalidate', spaceId: page.spaceId, pageId: page.id };
    const keys: Array<{ entity: string[]; id?: string }> = [
      { entity: ['working-changes', page.spaceId] },
      { entity: ['page-versions'], id: page.id },
      { entity: ['working-docs'], id: page.id },
      { entity: ['pages'], id: page.id },
      ...(page.slugId ? [{ entity: ['pages'], id: page.slugId }] : []),
    ];
    for (const key of keys) {
      this.wsService
        .emitTreeEvent(page.spaceId, { ...base, ...key })
        .catch(() => undefined);
    }
  }

  /**
   * 형상관리 스캐폴드 보증 — 구 코드 경로(복제·과거 데이터)로 스캐폴드 없이
   * 생성된 페이지를 자가 수복한다. 보정 후의 primaryWorkingDocId 를 반환.
   */
  async ensureScaffold(page: Page): Promise<string> {
    if (page.primaryWorkingDocId) {
      return page.primaryWorkingDocId;
    }

    const fullPage = await this.pageRepo.findById(page.id, {
      includeContent: true,
      includeYdoc: true,
      includeTextContent: true,
    });

    // 동시 수복 경합: 먼저 만든 쪽 승리
    if (fullPage.primaryWorkingDocId) {
      return fullPage.primaryWorkingDocId;
    }

    const { workingDocId } = await this.pageVersionRepo.createPageScaffold(
      fullPage,
      null,
    );
    this.logger.log(`Lazily scaffolded versioning for page ${page.id}`);
    return workingDocId;
  }

  /**
   * 문서확정(commit) — 작업문서의 현재 상태를 새 버전으로 확정.
   * D7: 확정된 버전은 항상 자동 Primary.
   *
   * `deleteOtherWorkingDocs` — 채택되지 않은 나머지 분기를 정리한다.
   * ⚠ 기본값이 **false(유지)** 인 것은 의도된 비대칭이다:
   *   - 웹 UI 는 확정 다이얼로그에서 삭제될 분기를 경고로 보여주고 사람이 보는
   *     앞에서 true 를 보낸다(체크박스로 유지 선택 가능).
   *   - MCP(에이전트)는 이 옵션을 노출하지 않는다 — 에이전트가 남의 분기를
   *     모르고 날리는 사고를 막기 위해 항상 유지 쪽으로 떨어져야 한다.
   * 그래서 플래그 이름을 "keep~" 이 아니라 "delete~" 로 둔다(빠뜨리면 안전 쪽).
   */
  async commit(
    page: Page,
    dto: {
      workingDocId?: string;
      message?: string;
      deleteOtherWorkingDocs?: boolean;
      /**
       * 직전 확정에 합치기(스쿼시). 'auto' — 조건이 맞으면 합치고 아니면 새 버전,
       * 'never' — 항상 새 버전(기본). 조건은 squashEligibility 참고.
       */
      squash?: 'auto' | 'never';
    },
    user: User,
  ): Promise<PageVersion & { squashed?: boolean; squashSkipped?: string | null }> {
    const primaryWorkingDocId = await this.ensureScaffold(page);
    const workingDocId = dto.workingDocId ?? primaryWorkingDocId;

    const workingDoc = await this.pageWorkingDocRepo.findById(workingDocId, {
      includeContent: true,
    });
    if (!workingDoc || workingDoc.pageId !== page.id) {
      throw new NotFoundException('Working doc not found');
    }

    // 라이브 협업 문서 상태를 직접 읽어 확정 시점 내용 보장
    const contentJson = await this.snapshotWorkingDoc(
      page.id,
      workingDocId,
      user,
    );
    const content = contentJson ?? workingDoc.content ?? EMPTY_DOC;

    let textContent: string | null = null;
    try {
      textContent = jsonToText(content);
    } catch (err) {
      this.logger.warn('jsonToText failed on commit: ' + err?.['message']);
    }

    let version: PageVersion & { squashed?: boolean };
    let squashSkipped: string | null = null;

    await executeTx(this.db, async (trx) => {
      const lockedPage = await this.pageRepo.findById(page.id, {
        withLock: true,
        trx,
      });
      if (!lockedPage) {
        throw new NotFoundException('Page not found');
      }

      // 변경 없음 가드 — 현재 Primary 버전과 동일 내용이면 확정 거부
      if (lockedPage.primaryVersionId) {
        const primaryVersion = await this.pageVersionRepo.findById(
          lockedPage.primaryVersionId,
          { includeContent: true, trx },
        );
        if (
          primaryVersion &&
          isDeepStrictEqual(primaryVersion.content, content)
        ) {
          throw new BadRequestException(
            'No changes to commit against the primary version',
          );
        }
      }

      // 스쿼시 — 같은 사람이 같은 작업문서로 막 확정한 버전에 이어 쓴다
      if (dto.squash === 'auto') {
        const check = await this.squashEligibility(
          lockedPage,
          workingDocId,
          user,
          trx,
        );
        if (check.target) {
          const contributorIds = Array.from(
            new Set([
              ...((check.target.contributorIds as string[]) ?? []),
              ...((workingDoc.contributorIds as string[]) ?? []),
            ]),
          );
          await this.pageVersionRepo.updateVersion(
            {
              content,
              title: lockedPage.title,
              icon: lockedPage.icon,
              coverPhoto: lockedPage.coverPhoto,
              message: dto.message ?? check.target.message ?? null,
              contributorIds,
              updatedAt: new Date(),
            } as any,
            check.target.id,
            trx,
          );
          await this.pageRepo.updatePage(
            { committedTextContent: textContent },
            page.id,
            trx,
          );
          await this.pageWorkingDocRepo.updateWorkingDoc(
            { contributorIds: [] },
            workingDocId,
            trx,
          );
          version = {
            ...(await this.pageVersionRepo.findById(check.target.id, { trx })),
            squashed: true,
          } as any;
          return;
        }
        squashSkipped = check.reason;
      }

      const nextVersion =
        ((await this.pageVersionRepo.maxVersion(page.id, trx)) ?? -1) + 1;

      version = await this.pageVersionRepo.insertVersion(
        {
          pageId: page.id,
          version: nextVersion,
          title: lockedPage.title,
          icon: lockedPage.icon,
          coverPhoto: lockedPage.coverPhoto,
          content,
          message: dto.message ?? null,
          creatorId: user.id,
          contributorIds: workingDoc.contributorIds ?? [],
          workingDocId,
          spaceId: page.spaceId,
          workspaceId: page.workspaceId,
        },
        trx,
      );

      // D7 — 항상 자동 Primary + committed 검색 미러
      const pageUpdate: UpdatablePage = {
        primaryVersionId: version.id,
        committedTextContent: textContent,
      };

      // 비채택 분기 정리 — 채택된 작업문서만 남긴다.
      // 남는 문서가 Primary 여야 하므로(Primary 작업문서는 삭제 불가) 필요하면
      // 승격하고 pages 미러(content/ydoc/text)도 함께 옮긴다.
      let doomedIds: string[] = [];
      if (dto.deleteOtherWorkingDocs) {
        doomedIds = await this.pageWorkingDocRepo.findOtherIdsByPageId(
          page.id,
          workingDocId,
          trx,
        );
        if (
          doomedIds.length > 0 &&
          lockedPage.primaryWorkingDocId !== workingDocId
        ) {
          const adopted = await this.pageWorkingDocRepo.findById(workingDocId, {
            includeContent: true,
            includeYdoc: true,
            trx,
          });
          pageUpdate.primaryWorkingDocId = workingDocId;
          pageUpdate.content = adopted.content;
          pageUpdate.ydoc = adopted.ydoc;
          pageUpdate.textContent = textContent;
        }
      }

      await this.pageRepo.updatePage(pageUpdate, page.id, trx);

      // 작업문서는 새 버전을 base 로 이어감 (git 의 HEAD 이동)
      await this.pageWorkingDocRepo.updateWorkingDoc(
        { baseVersionId: version.id, contributorIds: [] },
        workingDocId,
        trx,
      );

      // pages.primary_working_doc_id 를 옮긴 뒤에 지운다 (FK set null 회피)
      await this.pageWorkingDocRepo.deleteWorkingDocs(doomedIds, trx);
    });

    this.notifyVersionChange(page);
    return version.squashed ? version : { ...version, squashSkipped };
  }

  /**
   * 직전 확정에 합칠 수 있나. 합칠 대상은 «지금 Primary 이자 가장 최근 버전» 하나뿐이고,
   * 그 버전이 아직 «작성 중» 으로 볼 수 있을 때만 — 누가 그 시점을 붙잡고 있으면
   * 바꿀 수 없다:
   *  - 같은 사람이, 같은 작업문서로 확정했다
   *  - 처음 확정한 지 24시간이 지나지 않았다(합쳐도 이 시각은 그대로라 끝없이 늘지 않는다)
   *  - 파생이 없다 — 그 버전을 기준으로 한 다른 작업문서(분기), 그 버전에 묶인
   *    리뷰·리뷰 앵커, 그 버전에 고정된 공유 링크
   * 반환: target 이 있으면 합칠 수 있다. 없으면 reason 코드.
   */
  async squashEligibility(
    page: Page,
    workingDocId: string,
    user: User,
    trx?: any,
  ): Promise<{ target?: PageVersion; reason?: string }> {
    const db = trx ?? this.db;
    if (!page.primaryVersionId) return { reason: 'NO_PRIMARY' };
    const target = await this.pageVersionRepo.findById(page.primaryVersionId, {
      includeContent: true,
      trx,
    });
    if (!target || target.discardedAt) return { reason: 'NO_PRIMARY' };
    if (target.version < 1) return { reason: 'NO_PRIMARY' };

    const maxVersion = await this.pageVersionRepo.maxVersion(page.id, trx);
    // max() 는 드라이버에 따라 문자열로 온다 — 숫자로 맞춰 비교
    if (Number(maxVersion) !== Number(target.version)) {
      return { reason: 'NOT_LATEST' };
    }
    if (target.creatorId !== user.id) return { reason: 'OTHER_AUTHOR' };
    if (target.workingDocId !== workingDocId) return { reason: 'OTHER_BRANCH' };
    const ageMs = Date.now() - new Date(target.createdAt).getTime();
    if (ageMs > SQUASH_WINDOW_MS) return { reason: 'TOO_OLD' };

    const branch = await db
      .selectFrom('pageWorkingDocs')
      .select('id')
      .where('baseVersionId', '=', target.id)
      .where('id', '!=', workingDocId)
      .executeTakeFirst();
    if (branch) return { reason: 'HAS_BRANCHES' };

    const review = await db
      .selectFrom('reviews')
      .select('id')
      .where('versionId', '=', target.id)
      .executeTakeFirst();
    if (review) return { reason: 'HAS_REVIEWS' };

    const anchor = await db
      .selectFrom('reviewAnchors')
      .select('id')
      .where('versionId', '=', target.id)
      .executeTakeFirst();
    if (anchor) return { reason: 'HAS_REVIEWS' };

    const share = await db
      .selectFrom('shares')
      .select('id')
      .where('fixedVersionId', '=', target.id)
      .executeTakeFirst();
    if (share) return { reason: 'HAS_FIXED_SHARE' };

    return { target };
  }

  /**
   * 문서 Duplicate — "이 버전으로 새 페이지".
   * 유저 정책(0.14.3): 선택 버전과 지금까지의 수정사항 **둘만** 복사한다.
   *  ① 선택 버전 내용을 새 페이지의 v1 로 자동 확정(Primary)
   *     → 복제본도 곧바로 공유·미리보기·크로스문서 DIFF 가능
   *  ② 작업문서는 원본의 Primary 작업문서(라이브) 내용을 승계
   *     → 미확정 수정사항 보존. 선택 버전과 같으면 자연히 v1 == 작업문서
   * 나머지 버전 히스토리는 승계하지 않는다.
   */
  async duplicateVersionAsPage(
    version: PageVersion,
    user: User,
    workspaceId: string,
  ): Promise<Page> {
    const sourcePage = await this.pageRepo.findById(version.pageId);
    if (!sourcePage) {
      throw new NotFoundException('Source page not found');
    }

    const full = await this.pageVersionRepo.findById(version.id, {
      includeContent: true,
    });
    const versionContent = full?.content ?? EMPTY_DOC;

    // ② 원본 Primary 작업문서 승계 — 라이브 협업 문서를 우선 읽고(디바운스
    //    저장 지연 회피) 실패 시 DB 스냅샷으로 폴백.
    const sourceWorkingDocId = await this.ensureScaffold(sourcePage);
    const sourceWorkingDoc = await this.pageWorkingDocRepo.findById(
      sourceWorkingDocId,
      { includeContent: true },
    );
    const liveContent = await this.snapshotWorkingDoc(
      sourcePage.id,
      sourceWorkingDocId,
      user,
    );
    const workingContent =
      liveContent ?? sourceWorkingDoc?.content ?? versionContent;

    const newPage = await this.pageService.create(user.id, workspaceId, {
      title: version.title
        ? `${version.title} (버전 ${version.version})`
        : undefined,
      icon: version.icon ?? undefined,
      spaceId: sourcePage.spaceId,
      parentPageId: sourcePage.parentPageId ?? undefined,
      content: workingContent,
      format: 'json',
    } as any);

    // ① 선택 버전을 v1 으로 자동 확정
    await this.autoCommitDuplicatedVersion(
      newPage,
      versionContent,
      `버전 ${version.version}에서 복제됨`,
      user.id,
    );

    return this.pageRepo.findById(newPage.id);
  }

  /**
   * 복제본 v1 자동 확정 — 스캐폴드(버전 0 + 작업문서)가 이미 만들어진
   * 페이지에 확정 버전 하나를 얹는다. 작업문서 내용은 건드리지 않으므로
   * 확정 내용과 작업문서가 다르면 그대로 "미확정 수정사항"으로 남는다.
   */
  private async autoCommitDuplicatedVersion(
    page: Page,
    content: any,
    message: string,
    creatorId: string,
  ): Promise<void> {
    const workingDocId = await this.ensureScaffold(page);
    const textContent = this.safeJsonToText(content);

    await executeTx(this.db, async (trx) => {
      const lockedPage = await this.pageRepo.findById(page.id, {
        withLock: true,
        trx,
      });
      if (!lockedPage) {
        throw new NotFoundException('Page not found');
      }

      const nextVersion =
        ((await this.pageVersionRepo.maxVersion(page.id, trx)) ?? -1) + 1;

      const created = await this.pageVersionRepo.insertVersion(
        {
          pageId: page.id,
          version: nextVersion,
          title: lockedPage.title,
          icon: lockedPage.icon,
          coverPhoto: lockedPage.coverPhoto,
          content,
          message,
          creatorId,
          contributorIds: [],
          workingDocId,
          spaceId: page.spaceId,
          workspaceId: page.workspaceId,
        },
        trx,
      );

      await this.pageRepo.updatePage(
        {
          primaryVersionId: created.id,
          committedTextContent: textContent,
        },
        page.id,
        trx,
      );

      await this.pageWorkingDocRepo.updateWorkingDoc(
        { baseVersionId: created.id },
        workingDocId,
        trx,
      );
    });
  }

  async listVersions(pageId: string, pagination: PaginationOptions) {
    return this.pageVersionRepo.findVersionsByPageId(pageId, pagination);
  }

  /**
   * 버전 번호로 확정본 조회 — 새 창 미리보기 라우트가 쓴다.
   * URL 에 uuid 대신 사람이 읽는 번호(`/v/3`)를 싣기 위한 진입점.
   */
  async getVersionByNumber(
    pageId: string,
    version: number,
  ): Promise<PageVersion> {
    const found = await this.pageVersionRepo.findByPageAndVersion(
      pageId,
      version,
      { includeContent: true },
    );
    if (!found) {
      throw new NotFoundException('Version not found');
    }
    // 목록 카드와 같은 정보(작성자·기여자)를 쓰도록 id 조회로 한 번 더 채운다
    return this.getVersionInfo(found.id);
  }

  async getVersionInfo(versionId: string): Promise<PageVersion> {
    const version = await this.pageVersionRepo.findById(versionId, {
      includeContent: true,
    });
    if (!version) {
      throw new NotFoundException('Version not found');
    }
    return version;
  }

  /**
   * 버전 폐기 — 외부 공개에서 사라짐. Primary 였다면 가장 가까운
   * 비폐기 버전으로 자동 전환(없으면 미확정 상태로 회귀).
   */
  async discard(version: PageVersion, user: User): Promise<void> {
    if (version.version === 0) {
      throw new BadRequestException('Cannot discard the creation marker');
    }
    if (version.discardedAt) {
      throw new BadRequestException('Version already discarded');
    }

    await executeTx(this.db, async (trx) => {
      const page = await this.pageRepo.findById(version.pageId, {
        withLock: true,
        trx,
      });

      await this.pageVersionRepo.updateVersion(
        { discardedAt: new Date(), discardedById: user.id },
        version.id,
        trx,
      );

      if (page.primaryVersionId === version.id) {
        const fallback = await this.pageVersionRepo.findNearestActiveVersion(
          version.pageId,
          version.version,
          { includeContent: true, trx },
        );

        await this.pageRepo.updatePage(
          {
            primaryVersionId: fallback?.id ?? null,
            committedTextContent: fallback
              ? this.safeJsonToText(fallback.content)
              : null,
          },
          version.pageId,
          trx,
        );
      }
    });

    await this.notifyVersionChangeById(version.pageId);
  }

  async undiscard(version: PageVersion): Promise<void> {
    if (!version.discardedAt) {
      throw new BadRequestException('Version is not discarded');
    }

    await executeTx(this.db, async (trx) => {
      const page = await this.pageRepo.findById(version.pageId, {
        withLock: true,
        trx,
      });

      await this.pageVersionRepo.updateVersion(
        { discardedAt: null, discardedById: null },
        version.id,
        trx,
      );

      // 미확정 상태였다면 복원된 버전이 Primary 로
      if (!page.primaryVersionId) {
        const restored = await this.pageVersionRepo.findById(version.id, {
          includeContent: true,
          trx,
        });
        await this.pageRepo.updatePage(
          {
            primaryVersionId: version.id,
            committedTextContent: this.safeJsonToText(restored.content),
          },
          version.pageId,
          trx,
        );
      }
    });

    await this.notifyVersionChangeById(version.pageId);
  }

  /** 버전 ⋯ 메뉴 "Primary 로 변경" */
  async setPrimary(version: PageVersion): Promise<void> {
    if (version.version === 0) {
      throw new BadRequestException('Cannot set the creation marker as primary');
    }
    if (version.discardedAt) {
      throw new BadRequestException('Cannot set a discarded version as primary');
    }

    const withContent = await this.pageVersionRepo.findById(version.id, {
      includeContent: true,
    });

    await this.pageRepo.updatePage(
      {
        primaryVersionId: version.id,
        committedTextContent: this.safeJsonToText(withContent.content),
      },
      version.pageId,
    );

    await this.notifyVersionChangeById(version.pageId);
  }

  // ── 작업문서 ─────────────────────────────────────────────────────

  /**
   * 작업문서 목록.
   * `withModified` 면 각 문서에 "base 버전과 내용이 다른가"(= 결합 패널의
   * 원본/작업중 뱃지)를 실어 보낸다. **content 를 클라로 내리지 않기 위해**
   * 비교는 여기서 하고 boolean 한 칸만 나간다.
   *
   * 기본값이 false 인 이유: 이 엔드포인트는 footer pill 이 페이지를 열 때마다
   * 부른다(분기코드·작업문서 이름 때문에). 뱃지가 필요한 결합 패널이 열릴 때만
   * content 를 읽게 해서 뜨거운 경로를 가볍게 유지한다.
   */
  async listWorkingDocs(
    page: Page,
    opts?: { withModified?: boolean },
  ): Promise<PageWorkingDoc[]> {
    await this.ensureScaffold(page);
    const workingDocs = await this.pageWorkingDocRepo.findByPageId(page.id, {
      includeContent: opts?.withModified,
    });

    if (!opts?.withModified) {
      return workingDocs;
    }

    const baseIds = Array.from(
      new Set(workingDocs.map((doc) => doc.baseVersionId).filter(Boolean)),
    );
    const baseContents = new Map<string, any>();
    for (const baseId of baseIds) {
      const base = await this.pageVersionRepo.findById(baseId, {
        includeContent: true,
      });
      baseContents.set(baseId, base?.content ?? null);
    }

    return workingDocs.map(({ content, ...doc }: any) => ({
      ...doc,
      modified: !isSameDoc(
        doc.baseVersionId ? baseContents.get(doc.baseVersionId) : EMPTY_DOC,
        content,
      ),
    }));
  }

  async createWorkingDoc(
    page: Page,
    dto: { baseVersionId?: string; name?: string },
    user: User,
  ): Promise<PageWorkingDoc> {
    await this.ensureScaffold(page);

    const baseVersionId = dto.baseVersionId ?? page.primaryVersionId ?? null;

    let content: any = EMPTY_DOC;
    if (baseVersionId) {
      const baseVersion = await this.pageVersionRepo.findById(baseVersionId, {
        includeContent: true,
      });
      if (!baseVersion || baseVersion.pageId !== page.id) {
        throw new NotFoundException('Base version not found');
      }
      content = baseVersion.content ?? EMPTY_DOC;
    }

    return this.pageWorkingDocRepo.insertWorkingDoc({
      pageId: page.id,
      name: dto.name ?? null,
      baseVersionId,
      content,
      ydoc: createYdocFromJson(content),
      textContent: this.safeJsonToText(content),
      creatorId: user.id,
      contributorIds: [],
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
    });
  }

  /** 작업문서 삭제 — Primary 작업문서는 swap 전까지 삭제 불가 */
  async deleteWorkingDoc(workingDoc: PageWorkingDoc): Promise<void> {
    const page = await this.pageRepo.findById(workingDoc.pageId);
    if (page.primaryWorkingDocId === workingDoc.id) {
      throw new BadRequestException(
        'Cannot delete the primary working doc. Set another working doc as primary first.',
      );
    }
    await this.pageWorkingDocRepo.deleteWorkingDoc(workingDoc.id);
  }

  /** 작업문서 Primary swap — pages 미러(content/ydoc/text)도 함께 교체 */
  async setPrimaryWorkingDoc(workingDoc: PageWorkingDoc): Promise<void> {
    const full = await this.pageWorkingDocRepo.findById(workingDoc.id, {
      includeContent: true,
      includeYdoc: true,
    });

    await executeTx(this.db, async (trx) => {
      await this.pageRepo.findById(workingDoc.pageId, { withLock: true, trx });
      await this.pageRepo.updatePage(
        {
          primaryWorkingDocId: workingDoc.id,
          content: full.content,
          ydoc: full.ydoc,
          textContent: full.textContent ?? this.safeJsonToText(full.content),
        },
        workingDoc.pageId,
        trx,
      );
    });
  }

  /**
   * 수정취소(전체) — 작업문서를 **자기 base 버전** 내용으로 리셋.
   *
   * 0.14.2 까지는 Primary 로 되돌렸다(commit 이 Primary 와 비교하니 기준을
   * 통일한다는 논리). 그건 작업문서가 사실상 하나뿐이던 시절의 전제다. 분기가
   * 여럿인 지금 그 동작은 "이 분기 되돌리기" 를 눌렀는데 **다른 버전 내용이
   * 덮어써지는** 의미 위반이 된다(버전 4 기반 분기를 되돌렸더니 버전 5 본문이
   * 들어옴). base 가 없는 미확정 페이지만 Primary 로 폴백한다.
   * base == Primary 인 흔한 경우는 예전과 동작이 같다.
   */
  async resetWorkingDoc(workingDoc: PageWorkingDoc, user: User): Promise<void> {
    const page = await this.pageRepo.findById(workingDoc.pageId);
    const targetVersionId =
      workingDoc.baseVersionId ?? page?.primaryVersionId ?? null;

    let content: any = EMPTY_DOC;
    if (targetVersionId) {
      const targetVersion = await this.pageVersionRepo.findById(
        targetVersionId,
        { includeContent: true },
      );
      content = targetVersion?.content ?? EMPTY_DOC;
    }

    const documentName = pageDocumentName(workingDoc.pageId, workingDoc.id);
    await this.collaborationGateway.handleYjsEvent(
      'updatePageContent',
      documentName,
      {
        prosemirrorJson: content,
        operation: 'replace',
        user,
      },
    );
  }

  // ── 내부 ────────────────────────────────────────────────────────

  /**
   * 라이브 협업 문서를 읽는다. 직접 연결은 transact 뒤 저장 훅을 부르므로,
   * 사용자 컨텍스트를 함께 넘겨야 그 저장이 성공해 작업문서·pages 미러가
   * 지금 내용으로 맞춰진다. 예전엔 {} 를 넘겨 저장 훅이 context.user.id 에서
   * 터지고 롤백됐다 — 확정 직후 미러가 옛 내용이라 «수정중» 목록에 남았다.
   */
  private async snapshotWorkingDoc(
    pageId: string,
    workingDocId: string,
    user?: User,
  ): Promise<any | null> {
    const documentName = pageDocumentName(pageId, workingDocId);
    let json: any = null;
    try {
      const connection = await this.collaborationGateway.openDirectConnection(
        documentName,
        user ? { user } : {},
      );
      try {
        await connection.transact((doc) => {
          json = TiptapTransformer.fromYdoc(doc, 'default');
        });
      } finally {
        await connection.disconnect();
      }
    } catch (err) {
      this.logger.warn(
        `snapshotWorkingDoc failed for ${documentName}: ${err?.['message']}`,
      );
    }
    return json;
  }

  private safeJsonToText(content: any): string | null {
    if (!content) return null;
    try {
      return jsonToText(content);
    } catch {
      return null;
    }
  }
}
