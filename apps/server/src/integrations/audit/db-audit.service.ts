import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { AuditLogPayload, ActorType } from '../../common/events/audit-events';
import { AuditLogContext, IAuditService } from './audit.service';
import { AuditRepo } from '@manadocs/db/repos/audit/audit.repo';
import { AUDIT_CONTEXT_KEY } from '../../common/middlewares/audit-context.middleware';

@Injectable()
export class DbAuditService implements IAuditService {
  constructor(
    private readonly auditRepo: AuditRepo,
    private readonly cls: ClsService,
  ) {}

  setActorId(_actorId: string): void {
    // No-op: use logWithContext() to pass actorId explicitly
  }

  setActorType(_actorType: ActorType): void {
    // No-op: use logWithContext() to pass actorType explicitly
  }

  async log(payload: AuditLogPayload): Promise<void> {
    const ctx = this.cls.get(AUDIT_CONTEXT_KEY);
    if (!ctx?.workspaceId) return;

    const context: AuditLogContext = {
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      actorType: ctx.actorType ?? 'system',
      ipAddress: ctx.ipAddress ?? undefined,
      userAgent: ctx.userAgent ?? undefined,
    };

    await this.logWithContext(payload, context);
  }

  async logWithContext(
    payload: AuditLogPayload,
    context: AuditLogContext,
  ): Promise<void> {
    if (!context.workspaceId) return;

    try {
      await this.auditRepo.insert({
        workspaceId: context.workspaceId,
        actorId: context.actorId ?? null,
        actorType: context.actorType ?? 'system',
        event: payload.event,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId ?? null,
        spaceId: payload.spaceId ?? null,
        changes: payload.changes ? (payload.changes as any) : null,
        metadata: payload.metadata ? (payload.metadata as any) : null,
        ipAddress: context.ipAddress ?? null,
      });
    } catch (_err) {
      // Never let audit failures bubble up
    }
  }

  async logBatchWithContext(
    payloads: AuditLogPayload[],
    context: AuditLogContext,
  ): Promise<void> {
    if (!context.workspaceId || payloads.length === 0) return;

    try {
      await this.auditRepo.insertMany(
        payloads.map((payload) => ({
          workspaceId: context.workspaceId,
          actorId: context.actorId ?? null,
          actorType: context.actorType ?? 'system',
          event: payload.event,
          resourceType: payload.resourceType,
          resourceId: payload.resourceId ?? null,
          spaceId: payload.spaceId ?? null,
          changes: payload.changes ? (payload.changes as any) : null,
          metadata: payload.metadata ? (payload.metadata as any) : null,
          ipAddress: context.ipAddress ?? null,
        })),
      );
    } catch (_err) {
      // Never let audit failures bubble up
    }
  }

  async updateRetention(
    workspaceId: string,
    retentionDays: number,
  ): Promise<void> {
    if (retentionDays <= 0) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    try {
      await this.auditRepo.deleteOlderThan(workspaceId, cutoff);
    } catch (_err) {
      // ignore
    }
  }
}
