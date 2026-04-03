import { Global, Module } from '@nestjs/common';
import { AUDIT_SERVICE } from './audit.service';
import { DbAuditService } from './db-audit.service';
import { AuditRepo } from '@manadocs/db/repos/audit/audit.repo';

@Global()
@Module({
  providers: [
    AuditRepo,
    {
      provide: AUDIT_SERVICE,
      useClass: DbAuditService,
    },
  ],
  exports: [AUDIT_SERVICE],
})
export class AuditModule {}

// Keep backward-compatible export name used in app.module.ts
export { AuditModule as NoopAuditModule };
