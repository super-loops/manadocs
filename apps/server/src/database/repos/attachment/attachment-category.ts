import { ExpressionBuilder, ExpressionWrapper, SqlBool } from 'kysely';
import { DB } from '@manadocs/db/types/db';

/**
 * 에셋 브라우저 탭 분류. MIME 우선, MIME 이 비어 있으면 확장자로 보정한다.
 * 오디오·실행파일 등 나머지는 전부 'other' 로 떨어진다.
 */
export const attachmentCategories = [
  'image',
  'video',
  'text',
  'archive',
  'other',
] as const;

export type AttachmentCategory = (typeof attachmentCategories)[number];

/** 문서/텍스트로 묶는 MIME (text/* 는 prefix 로 따로 잡는다) */
const textMimes = [
  'application/pdf',
  'application/json',
  'application/xml',
  'application/rtf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const textExts = [
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.tsv',
  '.json',
  '.xml',
  '.yaml',
  '.yml',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.rtf',
  '.odt',
  '.ods',
  '.odp',
];

const archiveMimes = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/x-bzip2',
];

const archiveExts = [
  '.zip',
  '.7z',
  '.rar',
  '.tar',
  '.gz',
  '.tgz',
  '.bz2',
  '.xz',
];

type AttachmentEb = ExpressionBuilder<DB, 'attachments'>;

function mimeStartsWith(eb: AttachmentEb, prefix: string) {
  return eb('attachments.mimeType', 'like', `${prefix}%`);
}

function extIn(eb: AttachmentEb, exts: string[]) {
  // fileExt 는 업로드 시 소문자로 저장되지만 과거 행 보정을 위해 lower() 를 건다.
  return eb(eb.fn<string>('lower', ['attachments.fileExt']), 'in', exts);
}

/**
 * 카테고리 하나에 해당하는지 판정하는 boolean 식.
 * 'other' 는 나머지 넷 중 어디에도 안 걸리는 것.
 */
export function attachmentCategoryFilter(
  eb: AttachmentEb,
  category: AttachmentCategory,
): ExpressionWrapper<DB, 'attachments', SqlBool> {
  switch (category) {
    case 'image':
      return eb.and([mimeStartsWith(eb, 'image/')]) as any;
    case 'video':
      return eb.and([mimeStartsWith(eb, 'video/')]) as any;
    case 'text':
      return eb.or([
        mimeStartsWith(eb, 'text/'),
        eb('attachments.mimeType', 'in', textMimes),
        eb.and([
          eb('attachments.mimeType', 'is', null),
          extIn(eb, textExts),
        ]),
      ]) as any;
    case 'archive':
      return eb.or([
        eb('attachments.mimeType', 'in', archiveMimes),
        eb.and([
          eb('attachments.mimeType', 'is', null),
          extIn(eb, archiveExts),
        ]),
      ]) as any;
    case 'other':
    default:
      return eb.not(
        eb.or([
          attachmentCategoryFilter(eb, 'image'),
          attachmentCategoryFilter(eb, 'video'),
          attachmentCategoryFilter(eb, 'text'),
          attachmentCategoryFilter(eb, 'archive'),
        ]),
      ) as any;
  }
}
