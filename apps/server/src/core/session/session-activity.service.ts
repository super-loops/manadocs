import { Injectable } from '@nestjs/common';
import { UserSessionRepo } from '@manadocs/db/repos/session/user-session.repo';
import { UserRepo } from '@manadocs/db/repos/user/user.repo';

const THROTTLE_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class SessionActivityService {
  private readonly recentKeys = new Map<string, number>();

  constructor(
    private readonly userSessionRepo: UserSessionRepo,
    private readonly userRepo: UserRepo,
  ) {}

  trackActivity(sessionId: string, userId: string, workspaceId: string): void {
    const key = `session:activity:${sessionId}`;
    const now = Date.now();
    const lastSeen = this.recentKeys.get(key);

    if (lastSeen && now - lastSeen < THROTTLE_MS) {
      return; // throttled
    }

    this.recentKeys.set(key, now);

    this.userSessionRepo.updateLastActiveAt(sessionId).catch(() => {});
    this.userRepo
      .updateUser({ lastActiveAt: new Date() }, userId, workspaceId)
      .catch(() => {});
  }
}
