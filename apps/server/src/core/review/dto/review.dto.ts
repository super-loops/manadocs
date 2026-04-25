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
