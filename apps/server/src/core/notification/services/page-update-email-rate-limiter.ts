import { Injectable } from '@nestjs/common';

const TTL_MS = 86400 * 1000; // 24 hours
const MAX_IMMEDIATE_EMAILS = 4;

interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

@Injectable()
export class PageUpdateEmailRateLimiter {
  private readonly counters = new Map<string, RateLimitEntry>();
  private readonly digests = new Map<string, string[]>();

  async canSendEmail(userId: string): Promise<boolean> {
    const now = Date.now();
    const entry = this.counters.get(userId);

    if (entry && now < entry.expiresAt) {
      entry.count++;
      return entry.count <= MAX_IMMEDIATE_EMAILS;
    }

    this.counters.set(userId, { count: 1, expiresAt: now + TTL_MS });
    return true;
  }

  async addToDigest(userId: string, notificationId: string): Promise<boolean> {
    const existing = this.digests.get(userId);
    if (existing) {
      existing.push(notificationId);
      return false;
    }
    this.digests.set(userId, [notificationId]);
    return true;
  }

  async popDigest(userId: string): Promise<string[]> {
    const ids = this.digests.get(userId) ?? [];
    this.digests.delete(userId);
    return ids;
  }
}
