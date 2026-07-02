import {
  afterUnloadDocumentPayload,
  Extension,
  onChangePayload,
  onLoadDocumentPayload,
  onStoreDocumentPayload,
} from '@hocuspocus/server';
import * as Y from 'yjs';
import { Injectable, Logger } from '@nestjs/common';
import { TiptapTransformer } from '@hocuspocus/transformer';
import {
  getPageId,
  getWorkingDocId,
  jsonToText,
  tiptapExtensions,
} from '../collaboration.util';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { PageWorkingDocRepo } from '@manadocs/db/repos/page/page-working-doc.repo';
import { PageVersionRepo } from '@manadocs/db/repos/page/page-version.repo';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import { executeTx } from '@manadocs/db/utils';
import { InjectQueue, InMemoryQueue } from '../../integrations/queue/in-memory-queue';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import {
  extractMentions,
  extractUserMentions,
} from '../../common/helpers/prosemirror/utils';
import { isDeepStrictEqual } from 'node:util';
import { IPageMentionNotificationJob } from '../../integrations/queue/constants/queue.interface';
import { Page, PageWorkingDoc } from '@manadocs/db/types/entity.types';

@Injectable()
export class PersistenceExtension implements Extension {
  private readonly logger = new Logger(PersistenceExtension.name);
  private contributors: Map<string, Set<string>> = new Map();

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pageWorkingDocRepo: PageWorkingDocRepo,
    private readonly pageVersionRepo: PageVersionRepo,
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.AI_QUEUE) private aiQueue: InMemoryQueue,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE) private notificationQueue: InMemoryQueue,
  ) {}

  async onLoadDocument(data: onLoadDocumentPayload) {
    const { documentName, document } = data;
    const pageId = getPageId(documentName);

    if (!document.isEmpty('default')) {
      return;
    }

    const workingDoc = await this.resolveWorkingDoc(documentName);

    if (!workingDoc) {
      this.logger.warn(`working doc not found for ${documentName}`);
      return;
    }

    if (workingDoc.ydoc) {
      this.logger.debug(`ydoc loaded from db: ${documentName}`);

      const doc = new Y.Doc();
      const dbState = new Uint8Array(workingDoc.ydoc);

      Y.applyUpdate(doc, dbState);
      return doc;
    }

    // if no ydoc state in db convert working doc json content to Ydoc.
    if (workingDoc.content) {
      this.logger.debug(`converting json to ydoc: ${documentName}`);

      const ydoc = TiptapTransformer.toYdoc(
        workingDoc.content,
        'default',
        tiptapExtensions,
      );

      Y.encodeStateAsUpdate(ydoc);
      return ydoc;
    }

    this.logger.debug(`creating fresh ydoc: ${pageId}`);
    return new Y.Doc();
  }

  async onStoreDocument(data: onStoreDocumentPayload) {
    const { documentName, document, context } = data;

    const pageId = getPageId(documentName);
    const explicitWorkingDocId = getWorkingDocId(documentName);

    const tiptapJson = TiptapTransformer.fromYdoc(document, 'default');
    const ydocState = Buffer.from(Y.encodeStateAsUpdate(document));

    let textContent = null;

    try {
      textContent = jsonToText(tiptapJson);
    } catch (err) {
      this.logger.warn('jsonToText' + err?.['message']);
    }

    let page: Page = null;
    const editingUserIds = this.consumeContributors(documentName);

    try {
      await executeTx(this.db, async (trx) => {
        page = await this.pageRepo.findById(pageId, {
          withLock: true,
          includeContent: true,
          trx,
        });

        if (!page) {
          this.logger.error(`Page with id ${pageId} not found`);
          return;
        }

        const workingDocId =
          explicitWorkingDocId ?? page.primaryWorkingDocId ?? null;

        if (!workingDocId) {
          this.logger.error(
            `No working doc resolvable for ${documentName}; skipping store`,
          );
          page = null;
          return;
        }

        const workingDoc = await this.pageWorkingDocRepo.findById(
          workingDocId,
          { includeContent: true, withLock: true, trx },
        );

        if (!workingDoc || workingDoc.pageId !== page.id) {
          this.logger.error(
            `Working doc ${workingDocId} not found for page ${pageId}`,
          );
          page = null;
          return;
        }

        if (isDeepStrictEqual(tiptapJson, workingDoc.content)) {
          page = null;
          return;
        }

        let contributorIds = undefined;
        try {
          const existingContributors = workingDoc.contributorIds || [];
          contributorIds = Array.from(
            new Set([...existingContributors, ...editingUserIds, context.user.id]),
          );
        } catch (err) {
          //this.logger.debug('Contributors error:' + err?.['message']);
        }

        await this.pageWorkingDocRepo.updateWorkingDoc(
          {
            content: tiptapJson,
            textContent: textContent,
            ydoc: ydocState,
            contributorIds: contributorIds,
          },
          workingDocId,
          trx,
        );

        // Primary 작업문서는 pages 미러(검색·MCP·레거시 소비자 호환)도 갱신
        if (page.primaryWorkingDocId === workingDocId) {
          let pageContributorIds = undefined;
          try {
            const existing = page.contributorIds || [];
            pageContributorIds = Array.from(
              new Set([...existing, ...editingUserIds, page.creatorId]),
            );
          } catch {
            // noop
          }

          await this.pageRepo.updatePage(
            {
              content: tiptapJson,
              textContent: textContent,
              ydoc: ydocState,
              lastUpdatedById: context.user.id,
              contributorIds: pageContributorIds,
            },
            pageId,
            trx,
          );
        }

        this.logger.debug(
          `Working doc updated: ${documentName} - SlugId: ${page.slugId}`,
        );
      });
    } catch (err) {
      this.logger.error(`Failed to update page ${pageId}`, err);
    }

    if (page) {
      const mentions = extractMentions(tiptapJson);

      const userMentions = extractUserMentions(mentions);
      const oldMentions = page.content ? extractMentions(page.content) : [];
      const oldMentionedUserIds = extractUserMentions(oldMentions).map((m) => m.entityId);

      if (userMentions.length > 0) {
        await this.notificationQueue.add(QueueJob.PAGE_MENTION_NOTIFICATION, {
          userMentions: userMentions.map((m) => ({
            userId: m.entityId,
            mentionId: m.id,
            creatorId: m.creatorId,
          })),
          oldMentionedUserIds,
          pageId,
          spaceId: page.spaceId,
          workspaceId: page.workspaceId,
        } as IPageMentionNotificationJob);
      }

      await this.aiQueue.add(QueueJob.PAGE_CONTENT_UPDATED, {
        pageIds: [pageId],
        workspaceId: page.workspaceId,
      });
    }
  }

  async onChange(data: onChangePayload) {
    const documentName = data.documentName;
    const userId = data.context?.user?.id;

    if (!userId) return;

    if (!this.contributors.has(documentName)) {
      this.contributors.set(documentName, new Set());
    }

    this.contributors.get(documentName).add(userId);
  }

  async afterUnloadDocument(data: afterUnloadDocumentPayload) {
    const documentName = data.documentName;
    this.contributors.delete(documentName);
  }

  private consumeContributors(documentName: string): string[] {
    const contributorSet = this.contributors.get(documentName);
    if (!contributorSet) return [];
    const userIds = [...contributorSet];
    this.contributors.delete(documentName);
    return userIds;
  }

  /**
   * 문서 이름을 작업문서 row 로 해석한다.
   * - `page.<pageId>.<workingDocId>` → 해당 작업문서
   * - `page.<pageId>` (레거시) → Primary 작업문서. 스캐폴드가 없으면
   *   pages 의 현재 내용으로 자가 수복(lazy repair)한다.
   */
  private async resolveWorkingDoc(
    documentName: string,
  ): Promise<PageWorkingDoc | null> {
    const pageId = getPageId(documentName);
    const workingDocId = getWorkingDocId(documentName);

    if (workingDocId) {
      const workingDoc = await this.pageWorkingDocRepo.findById(workingDocId, {
        includeContent: true,
        includeYdoc: true,
      });
      if (!workingDoc || workingDoc.pageId !== pageId) {
        return null;
      }
      return workingDoc;
    }

    const page = await this.pageRepo.findById(pageId, {
      includeContent: true,
      includeYdoc: true,
      includeTextContent: true,
    });

    if (!page) {
      return null;
    }

    if (page.primaryWorkingDocId) {
      return this.pageWorkingDocRepo.findById(page.primaryWorkingDocId, {
        includeContent: true,
        includeYdoc: true,
      });
    }

    // lazy repair — 구 경로로 생성된 페이지
    const { workingDocId: repairedId } =
      await this.pageVersionRepo.createPageScaffold(page, null);
    this.logger.log(`Lazily scaffolded versioning for page ${pageId}`);
    return this.pageWorkingDocRepo.findById(repairedId, {
      includeContent: true,
      includeYdoc: true,
    });
  }
}
