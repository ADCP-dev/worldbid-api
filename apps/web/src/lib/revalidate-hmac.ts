// HMAC-SHA256 verification + event→tag map for ISR DIY (R-ISR-03/04).
// Standalone (Astro runtime) — mirrors the NestJS upload-post inbound pattern
// using crypto.createHmac + timingSafeEqual.

import { createHmac, timingSafeEqual } from 'node:crypto';

export type RevalidateEvent =
  | 'post.published'
  | 'post.updated'
  | 'post.unpublished'
  | 'post.deleted'
  | 'page.updated'
  | 'category.updated'
  | 'tag.updated';

export interface RevalidatePayload {
  id?: string;
  slug?: string;
  categoryId?: string;
  tagSlugs?: string[];
  pageSection?: string;
}

export interface RevalidateBody {
  event: RevalidateEvent;
  payload: RevalidatePayload;
  timestamp: string; // ISO 8601
}

const TIMESTAMP_MAX_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

// Constant-time HMAC-SHA256 verification. Returns true only if signature matches.
export function verifyWebhookSignature(
  signature: string | undefined,
  rawBody: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return false;

  try {
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// Reject timestamps older than 5 minutes (R-ISR-03).
export function isTimestampFresh(timestamp: string, now: number = Date.now()): boolean {
  const ts = Date.parse(timestamp);
  if (Number.isNaN(ts)) return false;
  return Math.abs(now - ts) < TIMESTAMP_MAX_DRIFT_MS;
}

// Map a revalidate event to the cache tags that must be purged (R-ISR-04).
// post.*   → ['blog', 'sitemap']
// page.*   → ['pages', 'sitemap'] (+['home'] if pageSection === 'landing')
// category → ['blog', 'sitemap']
// tag      → ['blog', 'sitemap']
export function mapEventToTags(event: RevalidateEvent, payload: RevalidatePayload): string[] {
  switch (event) {
    case 'post.published':
    case 'post.updated':
    case 'post.unpublished':
    case 'post.deleted':
      return ['blog', 'sitemap'];
    case 'page.updated':
      return payload.pageSection === 'landing'
        ? ['pages', 'sitemap', 'home']
        : ['pages', 'sitemap'];
    case 'category.updated':
      return ['blog', 'sitemap'];
    case 'tag.updated':
      return ['blog', 'sitemap'];
    default:
      return [];
  }
}