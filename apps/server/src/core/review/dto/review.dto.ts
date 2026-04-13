import {
  IsArray,
  IsIn,
  IsJSON,
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
  @IsJSON()
  content?: any;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  assigneeUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  assigneeGroupIds?: string[];
}

export class ChangeReviewStatusDto {
  @IsUUID()
  reviewId: string;

  @IsIn(['open', 'progress', 'resolved'])
  status: string;
}

export class AddReviewCommentDto {
  @IsUUID()
  reviewId: string;

  @IsJSON()
  content: any;
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
  @IsIn(['open', 'progress', 'resolved'])
  status?: string;
}

export class AssignedReviewsDto {
  @IsOptional()
  @IsArray()
  @IsIn(['open', 'progress', 'resolved'], { each: true })
  statuses?: string[];
}
