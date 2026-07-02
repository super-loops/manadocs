import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class PageVersionsDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;
}

export class VersionIdDto {
  @IsUUID()
  versionId: string;
}

export class VersionInfoDto extends VersionIdDto {}

export class CommitVersionDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsOptional()
  @IsUUID()
  workingDocId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class WorkingDocsDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;
}

export class WorkingDocIdDto {
  @IsUUID()
  workingDocId: string;
}

export class CreateWorkingDocDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsOptional()
  @IsUUID()
  baseVersionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
