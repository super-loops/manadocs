import { Extension, onAuthenticatePayload } from '@hocuspocus/server';
import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '../../core/auth/services/token.service';
import { UserRepo } from '@manadocs/db/repos/user/user.repo';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@manadocs/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@manadocs/db/repos/page/page-permission.repo';
import { findHighestUserSpaceRole } from '@manadocs/db/repos/space/utils';
import { SpaceRole } from '../../common/helpers/types/permission';
import { isUserDisabled } from '../../common/helpers';
import { getPageId, getWorkingDocId } from '../collaboration.util';
import { JwtCollabPayload, JwtType } from '../../core/auth/dto/jwt-payload';
import { PageWorkingDocRepo } from '@manadocs/db/repos/page/page-working-doc.repo';

@Injectable()
export class AuthenticationExtension implements Extension {
  private readonly logger = new Logger(AuthenticationExtension.name);

  constructor(
    private tokenService: TokenService,
    private userRepo: UserRepo,
    private pageRepo: PageRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly pageWorkingDocRepo: PageWorkingDocRepo,
  ) {}

  async onAuthenticate(data: onAuthenticatePayload) {
    const { documentName, token } = data;
    const pageId = getPageId(documentName);
    const workingDocId = getWorkingDocId(documentName);

    let jwtPayload: JwtCollabPayload;

    try {
      jwtPayload = await this.tokenService.verifyJwt(token, JwtType.COLLAB);
    } catch (error) {
      throw new UnauthorizedException('Invalid collab token');
    }

    const userId = jwtPayload.sub;
    const workspaceId = jwtPayload.workspaceId;

    const user = await this.userRepo.findById(userId, workspaceId);

    if (!user) {
      throw new UnauthorizedException();
    }

    if (isUserDisabled(user)) {
      throw new UnauthorizedException();
    }

    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      this.logger.debug(`Page not found: ${pageId}`);
      throw new NotFoundException('Page not found');
    }

    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      page.spaceId,
    );

    const userSpaceRole = findHighestUserSpaceRole(userSpaceRoles);

    if (!userSpaceRole) {
      this.logger.warn(`User not authorized to access page: ${pageId}`);
      throw new UnauthorizedException();
    }

    // 작업문서 room 유효성 — 명시된 작업문서가 이 페이지 소속인지 확인
    if (workingDocId) {
      const workingDoc = await this.pageWorkingDocRepo.findById(workingDocId);
      if (!workingDoc || workingDoc.pageId !== page.id) {
        this.logger.warn(
          `Working doc ${workingDocId} not found for page: ${pageId}`,
        );
        throw new NotFoundException('Working doc not found');
      }
    }

    // Check page-level permissions
    const { hasAnyRestriction, canAccess, canEdit } =
      await this.pagePermissionRepo.canUserEditPage(user.id, page.id);

    // D6 — 작업문서는 편집 권한자 전용. 읽기 전용 사용자는 협업 room 에
    // 접속할 수 없고, REST 로 확정본(Primary 버전)만 열람한다.
    if (hasAnyRestriction) {
      if (!canAccess) {
        this.logger.warn(
          `User ${user.id} denied page-level access to page: ${pageId}`,
        );
        throw new UnauthorizedException();
      }

      if (!canEdit) {
        this.logger.debug(
          `User ${user.id} denied working-doc access (no edit) to restricted page: ${pageId}`,
        );
        throw new UnauthorizedException();
      }
    } else {
      // No restrictions - use space-level permissions
      if (userSpaceRole === SpaceRole.READER) {
        this.logger.debug(
          `Reader denied working-doc access to page: ${pageId}`,
        );
        throw new UnauthorizedException();
      }
    }

    if (page.deletedAt) {
      data.connectionConfig.readOnly = true;
    }

    this.logger.debug(`Authenticated user ${user.id} on page ${pageId}`);

    return {
      user,
    };
  }
}
