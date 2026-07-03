import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PageVersionService } from './services/page-version.service';
import { PageAccessService } from './page-access/page-access.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@manadocs/db/pagination/pagination-options';
import { User, Workspace } from '@manadocs/db/types/entity.types';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { PageVersionRepo } from '@manadocs/db/repos/page/page-version.repo';
import { PageWorkingDocRepo } from '@manadocs/db/repos/page/page-working-doc.repo';
import {
  CommitVersionDto,
  CreateWorkingDocDto,
  PageVersionsDto,
  VersionIdDto,
  VersionInfoDto,
  WorkingDocIdDto,
  WorkingDocsDto,
} from './dto/page-version.dto';

@UseGuards(JwtAuthGuard)
@Controller('pages')
export class PageVersionController {
  constructor(
    private readonly pageVersionService: PageVersionService,
    private readonly pageAccessService: PageAccessService,
    private readonly pageRepo: PageRepo,
    private readonly pageVersionRepo: PageVersionRepo,
    private readonly pageWorkingDocRepo: PageWorkingDocRepo,
  ) {}

  // ── 버전 ────────────────────────────────────────────────────────

  @HttpCode(HttpStatus.OK)
  @Post('versions')
  async listVersions(
    @Body() dto: PageVersionsDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const page = await this.getPageOrThrow(dto.pageId);
    await this.pageAccessService.validateCanView(page, user);
    return this.pageVersionService.listVersions(page.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('versions/info')
  async getVersionInfo(@Body() dto: VersionInfoDto, @AuthUser() user: User) {
    const version = await this.pageVersionService.getVersionInfo(dto.versionId);
    const page = await this.getPageOrThrow(version.pageId);
    await this.pageAccessService.validateCanView(page, user);
    return version;
  }

  @HttpCode(HttpStatus.OK)
  @Post('versions/commit')
  async commit(@Body() dto: CommitVersionDto, @AuthUser() user: User) {
    const page = await this.getPageOrThrow(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    return this.pageVersionService.commit(
      page,
      { workingDocId: dto.workingDocId, message: dto.message },
      user,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('versions/discard')
  async discard(@Body() dto: VersionIdDto, @AuthUser() user: User) {
    const version = await this.getVersionOrThrow(dto.versionId);
    const page = await this.getPageOrThrow(version.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.pageVersionService.discard(version, user);
    return { success: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('versions/undiscard')
  async undiscard(@Body() dto: VersionIdDto, @AuthUser() user: User) {
    const version = await this.getVersionOrThrow(dto.versionId);
    const page = await this.getPageOrThrow(version.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.pageVersionService.undiscard(version);
    return { success: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('versions/set-primary')
  async setPrimary(@Body() dto: VersionIdDto, @AuthUser() user: User) {
    const version = await this.getVersionOrThrow(dto.versionId);
    const page = await this.getPageOrThrow(version.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.pageVersionService.setPrimary(version);
    return { success: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('versions/duplicate-page')
  async duplicatePage(
    @Body() dto: VersionIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const version = await this.getVersionOrThrow(dto.versionId);
    const page = await this.getPageOrThrow(version.pageId);
    // 원본을 볼 수 있으면 복제 가능 (새 페이지 생성 권한은 create 경로가 검증)
    await this.pageAccessService.validateCanView(page, user);
    return this.pageVersionService.duplicateVersionAsPage(
      version,
      user,
      workspace.id,
    );
  }

  // ── 작업문서 (D6: 편집 권한자 전용) ─────────────────────────────

  @HttpCode(HttpStatus.OK)
  @Post('working-docs')
  async listWorkingDocs(@Body() dto: WorkingDocsDto, @AuthUser() user: User) {
    const page = await this.getPageOrThrow(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    return this.pageVersionService.listWorkingDocs(page);
  }

  @HttpCode(HttpStatus.OK)
  @Post('working-docs/create')
  async createWorkingDoc(
    @Body() dto: CreateWorkingDocDto,
    @AuthUser() user: User,
  ) {
    const page = await this.getPageOrThrow(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    return this.pageVersionService.createWorkingDoc(
      page,
      { baseVersionId: dto.baseVersionId, name: dto.name },
      user,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('working-docs/delete')
  async deleteWorkingDoc(
    @Body() dto: WorkingDocIdDto,
    @AuthUser() user: User,
  ) {
    const workingDoc = await this.getWorkingDocOrThrow(dto.workingDocId);
    const page = await this.getPageOrThrow(workingDoc.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.pageVersionService.deleteWorkingDoc(workingDoc);
    return { success: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('working-docs/set-primary')
  async setPrimaryWorkingDoc(
    @Body() dto: WorkingDocIdDto,
    @AuthUser() user: User,
  ) {
    const workingDoc = await this.getWorkingDocOrThrow(dto.workingDocId);
    const page = await this.getPageOrThrow(workingDoc.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.pageVersionService.setPrimaryWorkingDoc(workingDoc);
    return { success: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('working-docs/reset')
  async resetWorkingDoc(
    @Body() dto: WorkingDocIdDto,
    @AuthUser() user: User,
  ) {
    const workingDoc = await this.getWorkingDocOrThrow(dto.workingDocId);
    const page = await this.getPageOrThrow(workingDoc.pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.pageVersionService.resetWorkingDoc(workingDoc, user);
    return { success: true };
  }

  // ── 내부 ────────────────────────────────────────────────────────

  private async getPageOrThrow(pageId: string) {
    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  private async getVersionOrThrow(versionId: string) {
    const version = await this.pageVersionRepo.findById(versionId);
    if (!version) {
      throw new NotFoundException('Version not found');
    }
    return version;
  }

  private async getWorkingDocOrThrow(workingDocId: string) {
    const workingDoc = await this.pageWorkingDocRepo.findById(workingDocId);
    if (!workingDoc) {
      throw new NotFoundException('Working doc not found');
    }
    return workingDoc;
  }
}
