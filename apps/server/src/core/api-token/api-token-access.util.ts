import { ForbiddenException } from '@nestjs/common';

/**
 * Shape that ApiTokenGuard attaches to request.user for api-token authenticated requests.
 */
export interface ApiTokenRequestUser {
  id: string;
  apiToken?: unknown;
  apiTokenSpaceScope?: 'all' | 'selected';
  apiTokenAllowedSpaceIds?: string[];
}

/**
 * Returns true if the current authenticated request (if any) is allowed to access the given space.
 *
 * - If the request is NOT authenticated via api-token (e.g. JWT session), returns true (no scope restriction).
 * - If scope is 'all' or undefined, returns true.
 * - If scope is 'selected', returns true iff spaceId ∈ allowedSpaceIds.
 */
export function isSpaceAllowedByApiToken(
  user: ApiTokenRequestUser | undefined | null,
  spaceId: string,
): boolean {
  if (!user || !user.apiTokenSpaceScope) return true;
  if (user.apiTokenSpaceScope === 'all') return true;
  return (user.apiTokenAllowedSpaceIds ?? []).includes(spaceId);
}

/**
 * Throws ForbiddenException if the current api-token-authenticated request is scoped
 * to selected spaces and the given spaceId is not in the allowed list.
 * No-op for JWT/session-authenticated requests or tokens with scope='all'.
 */
export function assertApiTokenSpaceAccess(
  user: ApiTokenRequestUser | undefined | null,
  spaceId: string,
): void {
  if (!isSpaceAllowedByApiToken(user, spaceId)) {
    throw new ForbiddenException(
      'API token is not scoped to access this space',
    );
  }
}

/**
 * Filters a list of spaceIds down to those allowed by the current api-token scope.
 * For JWT requests or scope='all', returns the input unchanged.
 */
export function filterSpaceIdsByApiToken(
  user: ApiTokenRequestUser | undefined | null,
  spaceIds: string[],
): string[] {
  if (!user || !user.apiTokenSpaceScope || user.apiTokenSpaceScope === 'all') {
    return spaceIds;
  }
  const allowed = new Set(user.apiTokenAllowedSpaceIds ?? []);
  return spaceIds.filter((id) => allowed.has(id));
}
