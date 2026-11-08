import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { MultipartFile } from '@fastify/multipart';
import { randomBytes } from 'crypto';
import * as path from 'path';
import { KyselyDB } from '@manadocs/db/types/kysely.types';
import { executeTx } from '@manadocs/db/utils';
import {
  ComponentRepo,
  ComponentWithCollection,
} from '@manadocs/db/repos/component/component.repo';
import { SpaceRepo } from '@manadocs/db/repos/space/space.repo';
import { Space, User } from '@manadocs/db/types/entity.types';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import { AttachmentService } from '../attachment/services/attachment.service';
import { CollaborationGateway } from '../../collaboration/collaboration.gateway';
import { pageDocumentName } from '../../collaboration/collaboration.util';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { PageAccessService } from '../page/page-access/page-access.service';
import {
  findInstances,
  instanceAttrsFor,
} from './component-instance.util';

export const COMPONENT_KINDS = ['image', 'file'] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
export const UPLOAD_TICKET_TTL_SEC = 600;

/** 에이전트가 읽고 다음 행동을 고를 수 있는 오류 — code 와 hint 를 함께 싣는다 */
export class ComponentError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    detail: Record<string, any> = {},
    status: number = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message, ...detail }, status);
  }
}

export function toComponentDto(c: ComponentWithCollection) {
  return {
    id: c.id,
    slug: c.slug,
    kind: c.kind,
    description: c.description,
    collectionId: c.collectionId,
    collectionName: c.collectionName,
    currentRevision: c.currentRevision,
    empty: c.currentRevision === 0,
    fileName: c.latestFileName,
    fileSize: c.latestFileSize != null ? Number(c.latestFileSize) : null,
    mimeType: c.latestMimeType,
    instanceAttrs: instanceAttrsFor(c),
    spaceId: c.spaceId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

@Injectable()
export class ComponentService {
  private readonly logger = new Logger(ComponentService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly componentRepo: ComponentRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly attachmentService: AttachmentService,
    private readonly collaborationGateway: CollaborationGateway,
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
  ) {}

  // ── 권한 ────────────────────────────────────────────────────────
  async resolveSpace(
    spaceIdOrSlug: string,
    user: User,
    workspaceId: string,
    need: 'read' | 'edit',
  ): Promise<Space> {
    const space = await this.spaceRepo.findById(spaceIdOrSlug, workspaceId);
    if (!space) throw new NotFoundException('Space not found');
    const ability = await this.spaceAbility.createForUser(user, space.id);
    const action =
      need === 'edit' ? SpaceCaslAction.Edit : SpaceCaslAction.Read;
    if (ability.cannot(action, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
    return space;
  }

  async getComponentChecked(
    componentId: string,
    user: User,
    workspaceId: string,
    need: 'read' | 'edit',
  ) {
    const component = await this.componentRepo.findById(componentId);
    if (!component || component.workspaceId !== workspaceId) {
      throw new NotFoundException('Component not found');
    }
    await this.resolveSpace(component.spaceId, user, workspaceId, need);
    return component;
  }

  /** slug 또는 id 로 찾는다 — MCP 는 slug 를 쓴다 */
  async findByRef(spaceId: string, ref: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      ref,
    );
    if (isUuid) {
      const byId = await this.componentRepo.findById(ref);
      if (byId && byId.spaceId === spaceId) return byId;
    }
    return this.componentRepo.findBySlug(spaceId, ref);
  }

  // ── 묶음 ────────────────────────────────────────────────────────
  async listCollections(spaceId: string) {
    const rows = await this.componentRepo.listCollections(spaceId);
    return rows.map((r) => ({ ...r, componentCount: Number(r.componentCount ?? 0) }));
  }

  async createCollection(
    space: Space,
    user: User,
    input: { name: string; description?: string | null },
  ) {
    const name = (input.name ?? '').trim();
    if (!name) throw new ComponentError('COLLECTION_NAME_REQUIRED', 'name is required');
    const existing = await this.componentRepo.findCollectionByName(space.id, name);
    if (existing) {
      throw new ComponentError(
        'COLLECTION_EXISTS',
        `Collection "${name}" already exists`,
        { existing: { id: existing.id, name: existing.name } },
        HttpStatus.CONFLICT,
      );
    }
    return this.componentRepo.insertCollection({
      name,
      description: input.description ?? null,
      position: await this.componentRepo.nextCollectionPosition(space.id),
      spaceId: space.id,
      workspaceId: space.workspaceId,
      creatorId: user.id,
    });
  }

  /** 이름으로 묶음을 찾고 없으면 만든다 — MCP create_component 가 쓴다 */
  async ensureCollection(space: Space, user: User, nameOrId: string) {
    const ref = (nameOrId ?? '').trim();
    if (!ref) throw new ComponentError('COLLECTION_REQUIRED', 'collection is required');
    if (/^[0-9a-f-]{36}$/i.test(ref)) {
      const byId = await this.componentRepo.findCollectionById(ref);
      if (byId && byId.spaceId === space.id) return byId;
    }
    const byName = await this.componentRepo.findCollectionByName(space.id, ref);
    if (byName) return byName;
    return this.createCollection(space, user, { name: ref });
  }

  async updateCollection(
    collectionId: string,
    user: User,
    workspaceId: string,
    input: { name?: string; description?: string | null },
  ) {
    const collection = await this.componentRepo.findCollectionById(collectionId);
    if (!collection || collection.workspaceId !== workspaceId) {
      throw new NotFoundException('Collection not found');
    }
    await this.resolveSpace(collection.spaceId, user, workspaceId, 'edit');
    const patch: Record<string, any> = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new ComponentError('COLLECTION_NAME_REQUIRED', 'name is required');
      const dup = await this.componentRepo.findCollectionByName(collection.spaceId, name);
      if (dup && dup.id !== collection.id) {
        throw new ComponentError('COLLECTION_EXISTS', `Collection "${name}" already exists`, {}, HttpStatus.CONFLICT);
      }
      patch.name = name;
    }
    if (input.description !== undefined) patch.description = input.description;
    return this.componentRepo.updateCollection(patch, collection.id);
  }

  /** 비어 있는 묶음만 지운다 — 안에 든 컴포넌트를 함께 지우지 않는다 */
  async deleteCollection(collectionId: string, user: User, workspaceId: string) {
    const collection = await this.componentRepo.findCollectionById(collectionId);
    if (!collection || collection.workspaceId !== workspaceId) {
      throw new NotFoundException('Collection not found');
    }
    await this.resolveSpace(collection.spaceId, user, workspaceId, 'edit');
    const count = await this.componentRepo.countLiveInCollection(collection.id);
    if (count > 0) {
      throw new ComponentError(
        'COLLECTION_NOT_EMPTY',
        `Collection has ${count} component(s). Move or delete them first.`,
        { count },
        HttpStatus.CONFLICT,
      );
    }
    await this.componentRepo.updateCollection({ deletedAt: new Date() }, collection.id);
    return { deleted: 1 };
  }

  // ── 컴포넌트 ────────────────────────────────────────────────────
  async createComponent(
    space: Space,
    user: User,
    input: {
      collection: string;
      slug: string;
      kind?: string;
      description?: string | null;
    },
  ) {
    const slug = String(input.slug ?? '').trim();
    if (!SLUG_RE.test(slug)) {
      throw new ComponentError(
        'INVALID_SLUG',
        'slug must be 1-80 chars of lowercase letters, digits, ".", "_" or "-", starting with a letter or digit',
        { slug },
      );
    }
    const kind = (input.kind ?? 'image') as ComponentKind;
    if (!COMPONENT_KINDS.includes(kind)) {
      throw new ComponentError('INVALID_KIND', 'kind must be "image" or "file"', { kind });
    }
    const existing = await this.componentRepo.findBySlug(space.id, slug);
    if (existing) {
      throw new ComponentError(
        'SLUG_TAKEN',
        `Component slug "${slug}" is already used in this space`,
        {
          existing: {
            ...toComponentDto(existing),
            instanceAttrs: undefined,
          },
          hint: 'If it is the same asset, insert an instance with this slug. Otherwise choose a new slug.',
        },
        HttpStatus.CONFLICT,
      );
    }
    const collection = await this.ensureCollection(space, user, input.collection);
    const created = await this.componentRepo.insertComponent({
      collectionId: collection.id,
      slug,
      kind,
      description: input.description ?? null,
      spaceId: space.id,
      workspaceId: space.workspaceId,
      creatorId: user.id,
    });
    return toComponentDto(await this.componentRepo.findById(created.id));
  }

  async updateComponent(
    componentId: string,
    user: User,
    workspaceId: string,
    input: { slug?: string; description?: string | null; collectionId?: string },
  ) {
    const component = await this.getComponentChecked(componentId, user, workspaceId, 'edit');
    const patch: Record<string, any> = {};
    if (input.slug !== undefined && input.slug !== component.slug) {
      const slug = input.slug.trim();
      if (!SLUG_RE.test(slug)) {
        throw new ComponentError('INVALID_SLUG', 'invalid slug', { slug });
      }
      const dup = await this.componentRepo.findBySlug(component.spaceId, slug);
      if (dup) throw new ComponentError('SLUG_TAKEN', `slug "${slug}" is taken`, {}, HttpStatus.CONFLICT);
      patch.slug = slug;
    }
    if (input.description !== undefined) patch.description = input.description;
    if (input.collectionId !== undefined) {
      const target = await this.componentRepo.findCollectionById(input.collectionId);
      if (!target || target.spaceId !== component.spaceId) {
        throw new NotFoundException('Collection not found');
      }
      patch.collectionId = target.id;
    }
    if (Object.keys(patch).length > 0) {
      await this.componentRepo.updateComponent(patch, component.id);
    }
    return toComponentDto(await this.componentRepo.findById(component.id));
  }

  /**
   * 지운 컴포넌트의 인스턴스는 문서에 사본으로 남는다(확정 버전과 같은 원리).
   * 리비전 파일도 지우지 않는다 — 그 사본이 가리키고 있다.
   */
  async deleteComponent(componentId: string, user: User, workspaceId: string) {
    const component = await this.getComponentChecked(componentId, user, workspaceId, 'edit');
    await this.componentRepo.updateComponent({ deletedAt: new Date() }, component.id);
    return { deleted: 1 };
  }

  async getDetail(componentId: string, user: User, workspaceId: string) {
    const component = await this.getComponentChecked(componentId, user, workspaceId, 'read');
    const revisions = await this.componentRepo.listRevisions(component.id);
    return {
      component: toComponentDto(component),
      revisions: revisions.map((r) => ({
        id: r.id,
        revision: r.revision,
        fileName: r.fileName,
        fileSize: r.fileSize != null ? Number(r.fileSize) : null,
        mimeType: r.mimeType,
        message: r.message,
        creatorId: r.creatorId,
        creatorName: (r as any).creatorName ?? null,
        createdAt: r.createdAt,
        src:
          r.attachmentId
            ? `/api/files/${r.attachmentId}/${encodeURIComponent(r.fileName)}`
            : null,
      })),
    };
  }

  /** 연결된 문서 — 작업문서 본문과 확정본에서 찾는다 */
  async getUsages(component: ComponentWithCollection) {
    const wds = await this.componentRepo.findWorkingDocsReferencing(
      component.spaceId,
      component.id,
    );
    const committed = await this.componentRepo.findCommittedPagesReferencing(
      component.spaceId,
      component.id,
    );

    type Usage = {
      pageId: string;
      slugId: string;
      title: string | null;
      icon: string | null;
      workingDocs: Array<{
        workingDocId: string;
        name: string | null;
        primary: boolean;
        locations: ReturnType<typeof findInstances>;
      }>;
      committed: null | { version: number; revisions: number[] };
    };
    const byPage = new Map<string, Usage>();
    const ensure = (pageId: string, slugId: string, title: string | null, icon: string | null) => {
      if (!byPage.has(pageId)) {
        byPage.set(pageId, { pageId, slugId, title, icon, workingDocs: [], committed: null });
      }
      return byPage.get(pageId);
    };

    for (const wd of wds) {
      const locations = findInstances(wd.content).filter(
        (l) => l.componentId === component.id,
      );
      if (locations.length === 0) continue;
      ensure(wd.pageId, wd.slugId, wd.title, wd.icon).workingDocs.push({
        workingDocId: wd.workingDocId,
        name: wd.workingDocName,
        primary: wd.primaryWorkingDocId === wd.workingDocId,
        locations,
      });
    }
    for (const row of committed) {
      const revisions = findInstances(row.content)
        .filter((l) => l.componentId === component.id)
        .map((l) => l.revision);
      if (revisions.length === 0) continue;
      ensure(row.pageId, row.slugId, row.title, null).committed = {
        version: row.version,
        revisions: Array.from(new Set(revisions)),
      };
    }

    return Array.from(byPage.values()).sort((a, b) =>
      (a.title ?? '').localeCompare(b.title ?? ''),
    );
  }

  // ── 리비전 ──────────────────────────────────────────────────────
  /**
   * 새 리비전. 리비전은 덮어쓰지 않는다. 빈 컴포넌트(r0)의 첫 업로드면 모든
   * 작업문서의 빈 인스턴스를 서버에서 채운다 — 나머지 인스턴스는 «업데이트 있음».
   */
  async addRevision(opts: {
    componentId: string;
    user: User;
    filePromise: Promise<MultipartFile>;
    message?: string | null;
    maxFileSize?: number;
  }) {
    const { user } = opts;
    const before = await this.componentRepo.findById(opts.componentId);
    if (!before) throw new NotFoundException('Component not found');

    // 형식은 저장하기 «전에» 본다 — 거절할 파일을 스토리지에 남기지 않는다
    const multipart = await opts.filePromise;
    if (before.kind === 'image') {
      const ext = path.extname(multipart?.filename ?? '').toLowerCase();
      if (!IMAGE_EXTS.includes(ext)) {
        multipart?.file?.resume?.();
        throw new ComponentError(
          'UNSUPPORTED_FILE',
          `Image components accept ${IMAGE_EXTS.join(', ')} (got "${ext || 'none'}")`,
          { accepted: IMAGE_EXTS },
        );
      }
    }

    const attachment = await this.attachmentService.uploadComponentFile({
      filePromise: Promise.resolve(multipart),
      spaceId: before.spaceId,
      userId: user.id,
      workspaceId: before.workspaceId,
    });

    let revisionNumber = 0;
    let previousRevision = 0;
    await executeTx(this.db, async (trx) => {
      const locked = await this.componentRepo.lockById(before.id, trx);
      if (!locked || locked.deletedAt) {
        throw new NotFoundException('Component not found');
      }
      previousRevision = locked.currentRevision;
      revisionNumber = locked.currentRevision + 1;
      await this.componentRepo.insertRevision(
        {
          componentId: locked.id,
          revision: revisionNumber,
          attachmentId: attachment.id,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          message: opts.message ?? null,
          creatorId: user.id,
        },
        trx,
      );
      await this.componentRepo.updateComponent(
        { currentRevision: revisionNumber },
        locked.id,
        trx,
      );
    });

    const after = await this.componentRepo.findById(before.id);
    let filled = 0;
    if (previousRevision === 0) {
      filled = await this.fillEmptyInstances(after, user);
    }
    return {
      component: toComponentDto(after),
      revision: revisionNumber,
      filledInstances: filled,
    };
  }

  private async fillEmptyInstances(
    component: ComponentWithCollection,
    user: User,
  ): Promise<number> {
    const attrs = instanceAttrsFor(component);
    const wds = await this.componentRepo.findWorkingDocsReferencing(
      component.spaceId,
      component.id,
    );
    let total = 0;
    for (const wd of wds) {
      const hasEmpty = findInstances(wd.content).some(
        (l) => l.componentId === component.id && l.revision === 0,
      );
      if (!hasEmpty) continue;
      // 업로더가 고칠 수 있는 페이지만 서버가 채운다. 나머지는 인스턴스가 최신
      // 리비전을 미리 보여주고 «채우기» 를 띄운다(클라이언트).
      try {
        const page = await this.pageRepo.findById(wd.pageId);
        if (!page || page.deletedAt) continue;
        await this.pageAccessService.validateCanEdit(page, user);
      } catch {
        continue;
      }
      try {
        const n = await this.collaborationGateway.handleYjsEvent(
          'updateComponentInstances',
          pageDocumentName(wd.pageId, wd.workingDocId),
          { componentId: component.id, attrs, onlyRevision: 0, user },
        );
        total += Number(n ?? 0);
      } catch (err) {
        this.logger.error(
          `fill failed for page ${wd.pageId} / ${wd.workingDocId}`,
          err,
        );
      }
    }
    return total;
  }

  // ── 업로드 티켓 (MCP) ──────────────────────────────────────────
  async issueTicket(opts: {
    component: ComponentWithCollection;
    userId: string;
    apiTokenId: string;
    workspaceId: string;
    message?: string | null;
  }) {
    await this.componentRepo.sweepTickets();
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + UPLOAD_TICKET_TTL_SEC * 1000);
    await this.componentRepo.insertTicket({
      token,
      componentId: opts.component.id,
      apiTokenId: opts.apiTokenId,
      userId: opts.userId,
      workspaceId: opts.workspaceId,
      message: opts.message ?? null,
      expiresAt,
    });
    return { token, expiresAt };
  }

  /**
   * 티켓 소비. 발급한 토큰과 다르면 없는 티켓과 같은 404(존재 여부를 흘리지 않는다).
   * 만료·사용됨은 410. 파일 문제(422)면 티켓은 살아 있다.
   */
  async redeemTicket(opts: {
    token: string;
    apiTokenId: string;
    workspaceId: string;
    user: User;
    filePromise: Promise<MultipartFile>;
  }) {
    const ticket = await this.componentRepo.findTicketByToken(opts.token);
    if (
      !ticket ||
      ticket.apiTokenId !== opts.apiTokenId ||
      ticket.workspaceId !== opts.workspaceId
    ) {
      throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'Upload ticket not found' });
    }
    if (ticket.consumedAt) {
      return { gone: 'TICKET_USED' as const };
    }
    if (new Date(ticket.expiresAt).getTime() < Date.now()) {
      return { gone: 'TICKET_EXPIRED' as const };
    }
    // 동시 두 번 업로드를 막는다 — 먼저 잡은 쪽만 소비
    const claimed = await executeTx(this.db, async (trx) => {
      const locked = await this.componentRepo.lockTicket(ticket.id, trx);
      if (!locked || locked.consumedAt) return false;
      await this.componentRepo.consumeTicket(ticket.id, trx);
      return true;
    });
    if (!claimed) return { gone: 'TICKET_USED' as const };

    try {
      const result = await this.addRevision({
        componentId: ticket.componentId,
        user: opts.user,
        filePromise: opts.filePromise,
        message: ticket.message,
      });
      return { result };
    } catch (err) {
      // 파일 문제면 다시 쓸 수 있게 되돌린다
      if (err instanceof ComponentError || (err as any)?.statusCode === 413) {
        await this.db
          .updateTable('componentUploadTickets')
          .set({ consumedAt: null })
          .where('id', '=', ticket.id)
          .execute();
      }
      throw err;
    }
  }
}
