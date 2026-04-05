import { validate as isValidUUID } from 'uuid';

/**
 * Accepts a raw pageId string that may be:
 *   - a UUID (returned as-is)
 *   - a bare 10-char slugId (returned as-is)
 *   - a URL segment like `getting-started-AyYJbu54nZ` or `-AyYJbu54nZ`
 *   - a full URL like `/s/docs/p/title-AyYJbu54nZ?anchor=...`
 *
 * slugIds are always 10 alphanumeric characters, so extract the trailing
 * 10-char alphanumeric run when the input isn't already a UUID.
 */
export function normalizePageId(raw: string): string {
  let s = String(raw ?? '').trim();
  if (!s) return s;
  if (isValidUUID(s)) return s;

  // Strip query/hash
  s = s.split('?')[0].split('#')[0];

  // If there's a /p/ segment, isolate what comes after the last one
  const pIdx = s.lastIndexOf('/p/');
  if (pIdx !== -1) s = s.slice(pIdx + 3);

  // Trim trailing slashes
  s = s.replace(/\/+$/, '');

  // Extract last 10-char alphanumeric run (slugId format)
  const matches = s.match(/[A-Za-z0-9]{10}/g);
  return matches && matches.length > 0 ? matches[matches.length - 1] : s;
}
