import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateShareDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsBoolean()
  @IsOptional()
  includeSubPages: boolean;

  @IsOptional()
  @IsBoolean()
  searchIndexing: boolean;

  // 공유타입 — 최신 Primary 추종 vs 특정 버전 고정
  @IsOptional()
  @IsIn(['primary', 'fixed'])
  versionMode?: 'primary' | 'fixed';

  @IsOptional()
  @IsUUID()
  fixedVersionId?: string;

  // 고정 버전 폐기 시 동작 (D3)
  @IsOptional()
  @IsIn(['fallback', '404'])
  onDiscard?: 'fallback' | '404';
}

export class UpdateShareDto extends CreateShareDto {
  @IsString()
  @IsNotEmpty()
  shareId: string;

  @IsString()
  @IsOptional()
  pageId: string;
}

export class ShareIdDto {
  @IsString()
  @IsNotEmpty()
  shareId: string;
}

export class SpaceIdDto {
  @IsUUID()
  spaceId: string;
}

export class ShareInfoDto {
  @IsString()
  @IsOptional()
  shareId?: string;

  @IsString()
  @IsOptional()
  pageId: string;
}

export class SharePageIdDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;
}
