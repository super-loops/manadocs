import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateReviewDto {
  @IsString()
  pageId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  assigneeUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  assigneeGroupIds?: string[];
}

export class UpdateReviewDto {
  @IsUUID()
  reviewId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;
}

export class ChangeReviewStatusDto {
  @IsUUID()
  reviewId: string;

  @IsIn(['open', 'progress', 'resolved', 'drop'])
  status: string;
}

export class AddReviewCommentDto {
  @IsUUID()
  reviewId: string;

  @IsString()
  content: string;
}

export class UpdateReviewCommentDto {
  @IsUUID()
  historyId: string;

  @IsString()
  content: string;
}

export class DeleteReviewCommentDto {
  @IsUUID()
  historyId: string;
}

export class CreateReviewAnchorDto {
  @IsUUID()
  reviewId: string;

  @IsUUID()
  pageId: string;

  // 앵커가 붙는 블록의 unique-id. 미지정이면 레거시(인라인 노드) 경로.
  @IsOptional()
  @IsString()
  blockId?: string;

  // 표시·fallback 용 발췌 텍스트
  @IsOptional()
  @IsString()
  selectedText?: string;

  // 명시 귀속 버전. 미지정이면 리뷰의 version_id 를 승계.
  @IsOptional()
  @IsUUID()
  versionId?: string;
}

export class DeleteReviewAnchorDto {
  @IsUUID()
  anchorId: string;
}

export class UpdateReviewAssigneesDto {
  @IsUUID()
  reviewId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  assigneeUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  assigneeGroupIds?: string[];
}

export class ReviewIdDto {
  @IsUUID()
  reviewId: string;
}

export class ReviewPageIdDto {
  @IsString()
  pageId: string;

  @IsOptional()
  @IsIn(['open', 'progress', 'resolved', 'drop'])
  status?: string;
}

export class AssignedReviewsDto {
  @IsOptional()
  @IsArray()
  @IsIn(['open', 'progress', 'resolved', 'drop'], { each: true })
  statuses?: string[];
}
