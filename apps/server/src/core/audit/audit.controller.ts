import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuditRepo } from '@manadocs/db/repos/audit/audit.repo';
import { ListAuditsDto } from './dto/list-audits.dto';

@Controller('audits')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditRepo: AuditRepo) {}

  @Get()
  async list(@Request() req: any, @Query() query: ListAuditsDto) {
    const workspaceId = req.user.workspace.id;

    const result = await this.auditRepo.list({
      workspaceId,
      limit: query.limit,
      offset: query.offset,
      event: query.event,
      actorId: query.actorId,
      resourceType: query.resourceType,
      spaceId: query.spaceId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    return result;
  }
}
