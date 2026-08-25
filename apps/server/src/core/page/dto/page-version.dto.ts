import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
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

/** 버전 번호로 조회 — 새 창 미리보기 라우트(/v/:versionNumber) 가 쓴다 */
export class VersionByNumberDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  version: number;
}

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

  /**
   * 채택되지 않은 나머지 작업문서(분기)를 함께 삭제할지.
   * 빠뜨리면 유지(false) — 안전 쪽이 기본. 웹 UI 만 경고를 보여준 뒤 true 를 보낸다.
   */
  @IsOptional()
  @IsBoolean()
  deleteOtherWorkingDocs?: boolean;
}

export class WorkingDocsDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  /**
   * 각 작업문서에 "base 버전과 다른가"(원본/작업중 뱃지)를 실어 달라는 요청.
   * content 를 읽어야 해서 기본은 꺼둔다 — 결합 패널만 켠다.
   */
  @IsOptional()
  @IsBoolean()
  withModified?: boolean;
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

export class WorkingChangesDto {
  @IsUUID()
  spaceId: string;
}
