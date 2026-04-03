import { Injectable } from '@nestjs/common';

@Injectable()
export class CollabHistoryService {
  private readonly contributors = new Map<string, Set<string>>();

  async addContributors(pageId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    let set = this.contributors.get(pageId);
    if (!set) {
      set = new Set();
      this.contributors.set(pageId, set);
    }
    for (const userId of userIds) {
      set.add(userId);
    }
  }

  async popContributors(pageId: string): Promise<string[]> {
    const set = this.contributors.get(pageId);
    if (!set || set.size === 0) return [];
    const result = Array.from(set);
    this.contributors.delete(pageId);
    return result;
  }

  async clearContributors(pageId: string): Promise<void> {
    this.contributors.delete(pageId);
  }
}
