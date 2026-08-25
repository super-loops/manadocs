import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@manadocs/db/types/kysely.types';
import { dbOrTx } from '@manadocs/db/utils';
import {
  Attachment,
  InsertableAttachment,
  UpdatableAttachment,
} from '@manadocs/db/types/entity.types';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import {
  executeWithPagination,
  PaginationResult,
} from '@manadocs/db/pagination/pagination';
import {
  AttachmentCategory,
  attachmentCategories,
  attachmentCategoryFilter,
} from './attachment-category';

export type SpaceAssetSortField = 'name' | 'date' | 'size';
export type SpaceAssetSortDirection = 'asc' | 'desc';

export interface SpaceAssetListOptions {
  category?: AttachmentCategory;
  query?: string;
  sort?: SpaceAssetSortField;
  direction?: SpaceAssetSortDirection;
  page?: number;
  limit?: number;
}

export interface SpaceAssetStats {
  totalCount: number;
  totalSize: number;
  recentCount: number;
  byCategory: Record<AttachmentCategory, number>;
}

@Injectable()
export class AttachmentRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof Attachment> = [
    'id',
    'fileName',
    'filePath',
    'fileSize',
    'fileExt',
    'mimeType',
    'type',
    'creatorId',
    'pageId',
    'spaceId',
    'workspaceId',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ];

  async findById(
    attachmentId: string,
    opts?: {
      trx?: KyselyTransaction;
    },
  ): Promise<Attachment> {
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('attachments')
      .select(this.baseFields)
      .where('id', '=', attachmentId)
      .executeTakeFirst();
  }

  async insertAttachment(
    insertableAttachment: InsertableAttachment,
    trx?: KyselyTransaction,
  ): Promise<Attachment> {
    const db = dbOrTx(this.db, trx);

    return db
      .insertInto('attachments')
      .values(insertableAttachment)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  /**
   * 에셋 브라우저용 스페이스 스코프 목록.
   * 파일 업로드(type='file')만 대상 — 아바타/스페이스 아이콘은 제외한다.
   */
  async getSpaceAssets(
    spaceId: string,
    opts: SpaceAssetListOptions = {},
  ): Promise<PaginationResult<any>> {
    const sort = opts.sort ?? 'date';
    const direction = opts.direction ?? (sort === 'name' ? 'asc' : 'desc');

    let query = this.db
      .selectFrom('attachments')
      .select(this.baseFields.map((f) => `attachments.${f}` as any))
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'attachments.creatorId'),
        ).as('creator'),
      )
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('pages')
            .select(['pages.id', 'pages.slugId', 'pages.title'])
            .whereRef('pages.id', '=', 'attachments.pageId'),
        ).as('page'),
      )
      .where('attachments.spaceId', '=', spaceId)
      .where('attachments.type', '=', 'file')
      .where('attachments.deletedAt', 'is', null);

    if (opts.category) {
      query = query.where((eb) =>
        attachmentCategoryFilter(eb, opts.category),
      );
    }

    if (opts.query?.trim()) {
      query = query.where(
        'attachments.fileName',
        'ilike',
        `%${opts.query.trim()}%`,
      );
    }

    if (sort === 'name') {
      query = query.orderBy('attachments.fileName', direction);
    } else if (sort === 'size') {
      query = query.orderBy(
        (eb) => eb.fn.coalesce('attachments.fileSize', eb.lit(0)),
        direction,
      );
    } else {
      query = query.orderBy('attachments.createdAt', direction);
    }
    query = query.orderBy('attachments.id', 'desc');

    return executeWithPagination(query, {
      page: opts.page ?? 1,
      perPage: opts.limit ?? 30,
    });
  }

  /** 개요 대시보드 + 에셋 브라우저 탭 배지에 쓰는 집계 */
  async getSpaceAssetStats(
    spaceId: string,
    recentSince: Date,
  ): Promise<SpaceAssetStats> {
    const base = this.db
      .selectFrom('attachments')
      .where('spaceId', '=', spaceId)
      .where('type', '=', 'file')
      .where('deletedAt', 'is', null);

    const [totals, recent, ...categoryRows] = await Promise.all([
      base
        .select((eb) => [
          eb.fn.countAll<string>().as('totalcount'),
          eb.fn
            .coalesce(eb.fn.sum<string>('fileSize'), eb.lit(0))
            .as('totalsize'),
        ])
        .executeTakeFirst(),
      base
        .select((eb) => eb.fn.countAll<string>().as('recentcount'))
        .where('createdAt', '>=', recentSince)
        .executeTakeFirst(),
      ...attachmentCategories.map((category) =>
        base
          .select((eb) => eb.fn.countAll<string>().as('categorycount'))
          .where((eb) => attachmentCategoryFilter(eb, category))
          .executeTakeFirst(),
      ),
    ]);

    const byCategory = {} as Record<AttachmentCategory, number>;
    attachmentCategories.forEach((category, index) => {
      byCategory[category] = Number(categoryRows[index]?.categorycount ?? 0);
    });

    return {
      totalCount: Number(totals?.totalcount ?? 0),
      totalSize: Number(totals?.totalsize ?? 0),
      recentCount: Number(recent?.recentcount ?? 0),
      byCategory,
    };
  }

  /** 개요 대시보드 "최근 업로드" 목록 */
  async getRecentSpaceAssets(spaceId: string, limit: number) {
    return this.db
      .selectFrom('attachments')
      .select([
        'attachments.id',
        'attachments.fileName',
        'attachments.fileExt',
        'attachments.fileSize',
        'attachments.mimeType',
        'attachments.pageId',
        'attachments.createdAt',
      ])
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'attachments.creatorId'),
        ).as('creator'),
      )
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('pages')
            .select(['pages.id', 'pages.slugId', 'pages.title'])
            .whereRef('pages.id', '=', 'attachments.pageId'),
        ).as('page'),
      )
      .where('attachments.spaceId', '=', spaceId)
      .where('attachments.type', '=', 'file')
      .where('attachments.deletedAt', 'is', null)
      .orderBy('attachments.createdAt', 'desc')
      .limit(limit)
      .execute();
  }

  async findBySpaceId(
    spaceId: string,
    opts?: {
      trx?: KyselyTransaction;
    },
  ): Promise<Attachment[]> {
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('attachments')
      .select(this.baseFields)
      .where('spaceId', '=', spaceId)
      .execute();
  }

  updateAttachmentsByPageId(
    updatableAttachment: UpdatableAttachment,
    pageIds: string[],
    trx?: KyselyTransaction,
  ) {
    return dbOrTx(this.db, trx)
      .updateTable('attachments')
      .set(updatableAttachment)
      .where('pageId', 'in', pageIds)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async updateAttachment(
    updatableAttachment: UpdatableAttachment,
    attachmentId: string,
  ): Promise<Attachment> {
    return await this.db
      .updateTable('attachments')
      .set(updatableAttachment)
      .where('id', '=', attachmentId)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async deleteAttachmentById(attachmentId: string): Promise<void> {
    await this.db
      .deleteFrom('attachments')
      .where('id', '=', attachmentId)
      .executeTakeFirst();
  }

  async deleteAttachmentByFilePath(attachmentFilePath: string): Promise<void> {
    await this.db
      .deleteFrom('attachments')
      .where('filePath', '=', attachmentFilePath)
      .executeTakeFirst();
  }
}
