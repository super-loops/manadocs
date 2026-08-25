import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SpaceService } from './services/space.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SpaceIdDto } from './dto/space-id.dto';
import { PaginationOptions } from '@manadocs/db/pagination/pagination-options';
import { SpaceMemberService } from './services/space-member.service';
import { User, Workspace } from '@manadocs/db/types/entity.types';
import { AddSpaceMembersDto } from './dto/add-space-members.dto';
import { RemoveSpaceMemberDto } from './dto/remove-space-member.dto';
import { UpdateSpaceMemberRoleDto } from './dto/update-space-member-role.dto';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { findHighestUserSpaceRole } from '@manadocs/db/repos/space/utils';
import { SpaceMemberRepo } from '@manadocs/db/repos/space/space-member.repo';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../casl/interfaces/workspace-ability.type';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory';
import { CreateSpaceDto } from './dto/create-space.dto';
import { SpaceOverviewService } from './services/space-overview.service';
import { SpaceMaintenanceService } from './services/space-maintenance.service';
import { SpaceRepo } from '@manadocs/db/repos/space/space.repo';

@UseGuards(JwtAuthGuard)
@Controller('spaces')
export class SpaceController {
  constructor(
    private readonly spaceService: SpaceService,
    private readonly spaceMemberService: SpaceMemberService,
    private readonly spaceOverviewService: SpaceOverviewService,
    private readonly spaceMaintenanceService: SpaceMaintenanceService,
    private readonly spaceRepo: SpaceRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  async getWorkspaceSpaces(
    @Body()
    pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    return this.spaceMemberService.getUserSpaces(user.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async getSpaceInfo(
    @Body() spaceIdDto: SpaceIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.spaceService.getSpaceInfo(
      spaceIdDto.spaceId,
      workspace.id,
    );

    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const ability = await this.spaceAbility.createForUser(user, space.id);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }

    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      space.id,
    );

    const userSpaceRole = findHighestUserSpaceRole(userSpaceRoles);

    const membership = {
      userId: user.id,
      role: userSpaceRole,
      permissions: ability.rules,
    };

    return { ...space, membership };
  }

  @HttpCode(HttpStatus.OK)
  @Post('overview')
  async getSpaceOverview(
    @Body() spaceIdDto: SpaceIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.resolveSpaceForRead(
      spaceIdDto.spaceId,
      user,
      workspace,
    );
    return this.spaceOverviewService.getOverview(space.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('page-version-badges')
  async getPageVersionBadges(
    @Body() spaceIdDto: SpaceIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.resolveSpaceForRead(
      spaceIdDto.spaceId,
      user,
      workspace,
    );
    return this.spaceOverviewService.getPageVersionBadges(space.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('maintenance/scan')
  async scanSpace(
    @Body() spaceIdDto: SpaceIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.spaceRepo.findById(
      spaceIdDto.spaceId,
      workspace.id,
    );
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    // 점검은 정리(휴지통) 액션이 따라붙으므로 페이지 관리 권한을 요구한다
    const ability = await this.spaceAbility.createForUser(user, space.id);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return this.spaceMaintenanceService.scan(space.id);
  }

  /** slug/uuid 를 모두 받아 스페이스를 찾고 읽기 권한을 확인한다 */
  private async resolveSpaceForRead(
    spaceIdOrSlug: string,
    user: User,
    workspace: Workspace,
  ) {
    const space = await this.spaceRepo.findById(spaceIdOrSlug, workspace.id);
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const ability = await this.spaceAbility.createForUser(user, space.id);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return space;
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  createSpace(
    @Body() createSpaceDto: CreateSpaceDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Space)
    ) {
      throw new ForbiddenException();
    }
    return this.spaceService.createSpace(user, workspace.id, createSpaceDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateSpace(
    @Body() updateSpaceDto: UpdateSpaceDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(
      user,
      updateSpaceDto.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }
    return this.spaceService.updateSpace(updateSpaceDto, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async deleteSpace(
    @Body() spaceIdDto: SpaceIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(
      user,
      spaceIdDto.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }
    return this.spaceService.deleteSpace(spaceIdDto.spaceId, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members')
  async getSpaceMembers(
    @Body() spaceIdDto: SpaceIdDto,
    @Body()
    pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(
      user,
      spaceIdDto.spaceId,
    );

    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.spaceMemberService.getSpaceMembers(
      spaceIdDto.spaceId,
      workspace.id,
      pagination,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/add')
  async addSpaceMember(
    @Body() dto: AddSpaceMembersDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (
      (!dto.userIds || dto.userIds.length === 0) &&
      (!dto.groupIds || dto.groupIds.length === 0)
    ) {
      throw new BadRequestException('userIds or groupIds is required');
    }

    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.spaceMemberService.addMembersToSpaceBatch(
      dto,
      user,
      workspace.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/remove')
  async removeSpaceMember(
    @Body() dto: RemoveSpaceMemberDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.validateIds(dto);

    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.spaceMemberService.removeMemberFromSpace(dto, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/change-role')
  async updateSpaceMemberRole(
    @Body() dto: UpdateSpaceMemberRoleDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.validateIds(dto);

    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.spaceMemberService.updateSpaceMemberRole(dto, workspace.id);
  }

  validateIds(dto: RemoveSpaceMemberDto | UpdateSpaceMemberRoleDto) {
    if (!dto.userId && !dto.groupId) {
      throw new BadRequestException('userId or groupId is required');
    }
    if (dto.userId && dto.groupId) {
      throw new BadRequestException(
        'please provide either a userId or groupId and both',
      );
    }
  }
}
