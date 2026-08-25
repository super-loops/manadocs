import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  attachmentCategories,
  AttachmentCategory,
} from '@manadocs/db/repos/attachment/attachment-category';
import {
  SpaceAssetSortDirection,
  SpaceAssetSortField,
} from '@manadocs/db/repos/attachment/attachment.repo';

export class SpaceAssetsDto {
  @IsNotEmpty()
  @IsString()
  spaceId: string;

  @IsOptional()
  @IsIn(attachmentCategories as unknown as string[])
  category?: AttachmentCategory;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsIn(['name', 'date', 'size'])
  sort?: SpaceAssetSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  direction?: SpaceAssetSortDirection;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SpaceAssetStatsDto {
  @IsNotEmpty()
  @IsString()
  spaceId: string;
}
