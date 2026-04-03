import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditRepo } from '@manadocs/db/repos/audit/audit.repo';

@Module({
  controllers: [AuditController],
  providers: [AuditRepo],
})
export class AuditModule {}
