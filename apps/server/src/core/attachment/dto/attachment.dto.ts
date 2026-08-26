import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { AttachmentType } from '../attachment.constants';

export class AttachmentInfoDto {
  @IsNotEmpty()
  @IsUUID()
  attachmentId: string;
}

/** 첨부파일 영구 삭제 — 에셋 브라우저에서 소속을 잃은 파일을 걷어낼 때도 쓴다 */
export class DeleteAttachmentDto {
  @IsNotEmpty()
  @IsUUID()
  attachmentId: string;
}

export class RemoveIconDto {
  @IsEnum(AttachmentType)
  @IsIn([
    AttachmentType.Avatar,
    AttachmentType.SpaceIcon,
    AttachmentType.WorkspaceIcon,
  ])
  @IsNotEmpty()
  type: AttachmentType;

  @IsOptional()
  @IsUUID()
  spaceId: string;
}
