import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomBytes } from 'crypto';

interface SessionData {
  userId: string;
  workspaceId: string;
  createdAt: number;
  lastUsedAt: number;
}

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class McpSessionService implements OnModuleDestroy {
  private sessions = new Map<string, SessionData>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  create(userId: string, workspaceId: string): string {
    const sessionId = randomBytes(16).toString('hex');
    const now = Date.now();
    this.sessions.set(sessionId, {
      userId,
      workspaceId,
      createdAt: now,
      lastUsedAt: now,
    });
    return sessionId;
  }

  get(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (Date.now() - session.lastUsedAt > SESSION_TTL_MS) {
      this.sessions.delete(sessionId);
      return null;
    }
    session.lastUsedAt = Date.now();
    return session;
  }

  destroy(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastUsedAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }
}
