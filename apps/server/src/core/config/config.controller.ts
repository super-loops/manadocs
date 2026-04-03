import {
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User } from '@manadocs/db/types/entity.types';
import { UserRole } from '../../common/helpers/types/permission';
import { ConfigService } from './config.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @HttpCode(HttpStatus.OK)
  @Post('admin/environment')
  getEnvironment(@AuthUser() user: User) {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
    return {
      entries: this.configService.getEnvRuntime(),
    };
  }
}
