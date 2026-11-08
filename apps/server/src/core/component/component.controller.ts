import {
  BadRequestException,
  Body,
  Controller,
  GoneException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import * as bytes from 'bytes';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { FileInterceptor } from '../../common/interceptors/file.interceptor';
import { User, Workspace } from '@manadocs/db/types/entity.types';
import { ComponentRepo } from '@manadocs/db/repos/component/component.repo';
import { UserRepo } from '@manadocs/db/repos/user/user.repo';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { ApiTokenService } from '../api-token/services/api-token.service';
import { ComponentService, toComponentDto } from './component.service';

@UseGuards(JwtAuthGuard)
@Controller('components')
export class ComponentController {
  constructor(
    private readonly componentService: ComponentService,
    private readonly componentRepo: ComponentRepo,
    private readonly environmentService: EnvironmentService,
  ) {}

  // ── 묶음 ────────────────────────────────────────────────────────
  @HttpCode(HttpStatus.OK)
  @Post('collections')
  async listCollections(
    @Body() dto: { spaceId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.componentService.resolveSpace(
      dto.spaceId,
      user,
      workspace.id,
      'read',
    );
    return this.componentService.listCollections(space.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('collections/create')
  async createCollection(
    @Body() dto: { spaceId: string; name: string; description?: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.componentService.resolveSpace(
      dto.spaceId,
      user,
      workspace.id,
      'edit',
    );
    return this.componentService.createCollection(space, user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('collections/update')
  async updateCollection(
    @Body() dto: { collectionId: string; name?: string; description?: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.componentService.updateCollection(
      dto.collectionId,
      user,
      workspace.id,
      dto,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('collections/delete')
  async deleteCollection(
    @Body() dto: { collectionId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.componentService.deleteCollection(
      dto.collectionId,
      user,
      workspace.id,
    );
  }

  // ── 컴포넌트 ────────────────────────────────────────────────────
  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(
    @Body()
    dto: {
      spaceId: string;
      collectionId?: string;
      query?: string;
      kind?: string;
      emptyOnly?: boolean;
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.componentService.resolveSpace(
      dto.spaceId,
      user,
      workspace.id,
      'read',
    );
    const rows = await this.componentRepo.listComponents({
      spaceId: space.id,
      collectionId: dto.collectionId,
      query: dto.query,
      kind: dto.kind,
      emptyOnly: !!dto.emptyOnly,
    });
    return rows.map(toComponentDto);
  }

  /** 문서 안 인스턴스들의 현재 상태(최신 리비전·묶음)를 한 번에 */
  @HttpCode(HttpStatus.OK)
  @Post('bulk')
  async bulk(
    @Body() dto: { spaceId: string; componentIds: string[] },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.componentService.resolveSpace(
      dto.spaceId,
      user,
      workspace.id,
      'read',
    );
    const ids = Array.isArray(dto.componentIds)
      ? dto.componentIds.filter((id) => typeof id === 'string').slice(0, 200)
      : [];
    const rows = await this.componentRepo.findByIds(ids);
    return rows.filter((r) => r.spaceId === space.id).map(toComponentDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async info(
    @Body() dto: { componentId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.componentService.getDetail(dto.componentId, user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('usages')
  async usages(
    @Body() dto: { componentId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const component = await this.componentService.getComponentChecked(
      dto.componentId,
      user,
      workspace.id,
      'read',
    );
    return this.componentService.getUsages(component);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body()
    dto: {
      spaceId: string;
      collection: string;
      slug: string;
      kind?: string;
      description?: string;
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.componentService.resolveSpace(
      dto.spaceId,
      user,
      workspace.id,
      'edit',
    );
    return this.componentService.createComponent(space, user, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body()
    dto: {
      componentId: string;
      slug?: string;
      description?: string;
      collectionId?: string;
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.componentService.updateComponent(
      dto.componentId,
      user,
      workspace.id,
      dto,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async remove(
    @Body() dto: { componentId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.componentService.deleteComponent(
      dto.componentId,
      user,
      workspace.id,
    );
  }

  /** 사람이 올리는 새 리비전 (멀티파트: componentId, message?, file) */
  @HttpCode(HttpStatus.OK)
  @Post('upload-revision')
  @UseInterceptors(FileInterceptor)
  async uploadRevision(
    @Req() req: any,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const maxFileSize = bytes(this.environmentService.getFileUploadSizeLimit());
    let file = null;
    try {
      file = await req.file({
        limits: { fileSize: maxFileSize, fields: 3, files: 1 },
      });
    } catch (err: any) {
      if (err?.statusCode === 413) {
        throw new BadRequestException(
          `File too large. Exceeds the ${this.environmentService.getFileUploadSizeLimit()} limit`,
        );
      }
    }
    if (!file) throw new BadRequestException('file is required');
    const componentId = file.fields?.componentId?.value;
    if (!componentId) throw new BadRequestException('componentId is required');
    await this.componentService.getComponentChecked(
      componentId,
      user,
      workspace.id,
      'edit',
    );
    return this.componentService.addRevision({
      componentId,
      user,
      filePromise: Promise.resolve(file),
      message: file.fields?.message?.value ?? null,
    });
  }
}

/**
 * 에이전트 업로드 — upload_ticket 이 돌려준 URL 로 멀티파트 POST 한 번.
 *
 * 티켓이 곧 인증이다(미리 서명된 URL처럼): 추측할 수 없고 1회용·10분이며, 발급한
 * MCP 토큰이 살아 있을 때만 유효하다. 그래서 에이전트가 curl 에 토큰을 적지
 * 않아도 된다. Authorization 을 보내면 그 토큰은 발급 토큰과 같아야 한다.
 */
@Controller('mcp/uploads')
export class ComponentUploadController {
  constructor(
    private readonly componentService: ComponentService,
    private readonly componentRepo: ComponentRepo,
    private readonly userRepo: UserRepo,
    private readonly apiTokenService: ApiTokenService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @HttpCode(HttpStatus.CREATED)
  @Post(':ticket')
  @UseInterceptors(FileInterceptor)
  async upload(@Req() req: any, @Param('ticket') ticketToken: string) {
    const ticket = await this.componentRepo.findTicketByToken(ticketToken);
    const notFound = () =>
      new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Upload ticket not found',
      });
    if (!ticket) throw notFound();

    const authHeader: string | undefined = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const validation = await this.apiTokenService.validateToken(
        authHeader.substring('Bearer '.length),
      );
      if (!validation || (validation.apiToken as any).id !== ticket.apiTokenId) {
        throw notFound();
      }
    } else if (!(await this.componentRepo.isApiTokenActive(ticket.apiTokenId))) {
      throw notFound();
    }

    const user = await this.userRepo.findById(ticket.userId, ticket.workspaceId);
    if (!user) throw notFound();

    const maxFileSize = bytes(this.environmentService.getFileUploadSizeLimit());
    let file = null;
    try {
      file = await req.file({
        limits: { fileSize: maxFileSize, fields: 2, files: 1 },
      });
    } catch (err: any) {
      if (err?.statusCode === 413) {
        throw new BadRequestException({
          code: 'FILE_TOO_LARGE',
          message: `File too large. Max ${this.environmentService.getFileUploadSizeLimit()}`,
        });
      }
    }
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'multipart field "file" is required',
      });
    }

    const out = await this.componentService.redeemTicket({
      token: ticketToken,
      apiTokenId: ticket.apiTokenId,
      workspaceId: ticket.workspaceId,
      user,
      filePromise: Promise.resolve(file),
    });
    if ('gone' in out) {
      file.file?.resume?.();
      throw new GoneException({
        code: out.gone,
        message:
          out.gone === 'TICKET_USED'
            ? 'This upload ticket was already used. Request a new one with upload_ticket.'
            : 'This upload ticket expired (10 minutes). Request a new one with upload_ticket.',
      });
    }
    const { component, revision, filledInstances } = out.result;
    return {
      ok: true,
      component: {
        id: component.id,
        slug: component.slug,
        collection: component.collectionName,
      },
      revision,
      filledInstances,
      next:
        filledInstances > 0
          ? `Revision r${revision} is live. ${filledInstances} empty instance(s) were filled.`
          : `Revision r${revision} is live. Pages pinned to an older revision show "update available".`,
    };
  }
}
