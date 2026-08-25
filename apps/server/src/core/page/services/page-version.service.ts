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
import { executeTx } from '@manadocs/db/utils';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { PageVersionRepo } from '@manadocs/db/repos/page/page-version.repo';
import { PageWorkingDocRepo } from '@manadocs/db/repos/page/page-working-doc.repo';
import { PageService } from './page.service';
import {
  Page,
  PageVersion,
  PageWorkingDoc,
  User,
} from '@manadocs/db/types/entity.types';
import { PaginationOptions } from '@manadocs/db/pagination/pagination-options';
import { CollaborationGateway } from '../../../collaboration/collaboration.gateway';
import {
  jsonToText,
  pageDocumentName,
} from '../../../collaboration/collaboration.util';
import { createYdocFromJson } from '../../../common/helpers/prosemirror/utils';

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
  ) {}

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
   */
  async commit(
    page: Page,
    dto: { workingDocId?: string; message?: string },
    user: User,
  ): Promise<PageVersion> {
    const primaryWorkingDocId = await this.ensureScaffold(page);
    const workingDocId = dto.workingDocId ?? primaryWorkingDocId;

    const workingDoc = await this.pageWorkingDocRepo.findById(workingDocId, {
      includeContent: true,
    });
    if (!workingDoc || workingDoc.pageId !== page.id) {
      throw new NotFoundException('Working doc not found');
    }

    // 라이브 협업 문서 상태를 직접 읽어 확정 시점 내용 보장
    const contentJson = await this.snapshotWorkingDoc(page.id, workingDocId);
    const content = contentJson ?? workingDoc.content ?? EMPTY_DOC;

    let textContent: string | null = null;
    try {
      textContent = jsonToText(content);
    } catch (err) {
      this.logger.warn('jsonToText failed on commit: ' + err?.['message']);
    }

    let version: PageVersion;

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
      await this.pageRepo.updatePage(
        {
          primaryVersionId: version.id,
          committedTextContent: textContent,
        },
        page.id,
        trx,
      );

      // 작업문서는 새 버전을 base 로 이어감 (git 의 HEAD 이동)
      await this.pageWorkingDocRepo.updateWorkingDoc(
        { baseVersionId: version.id, contributorIds: [] },
        workingDocId,
        trx,
      );
    });

    return version;
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
  }

  // ── 작업문서 ─────────────────────────────────────────────────────

  async listWorkingDocs(page: Page): Promise<PageWorkingDoc[]> {
    await this.ensureScaffold(page);
    return this.pageWorkingDocRepo.findByPageId(page.id);
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
   * 수정취소(전체) — 작업문서를 **Primary 버전** 내용으로 리셋.
   * 문서확정(commit)이 Primary 와 비교해 새 버전을 만들므로, 되돌림 기준도
   * Primary 로 통일한다(footer 변경감지·DIFF·reset 한 기준). Primary 가 없으면
   * (미확정 페이지) 작업문서의 base 버전으로 폴백.
   */
  async resetWorkingDoc(workingDoc: PageWorkingDoc, user: User): Promise<void> {
    const page = await this.pageRepo.findById(workingDoc.pageId);
    const targetVersionId =
      page?.primaryVersionId ?? workingDoc.baseVersionId ?? null;

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

  private async snapshotWorkingDoc(
    pageId: string,
    workingDocId: string,
  ): Promise<any | null> {
    const documentName = pageDocumentName(pageId, workingDocId);
    let json: any = null;
    try {
      const connection = await this.collaborationGateway.openDirectConnection(
        documentName,
        {},
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
