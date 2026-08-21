// POST /api/revalidate — ISR DIY webhook receiver (R-ISR-02/03/04/05).
// Full implementation: HMAC-SHA256 verify + timestamp freshness (5min) +
// mapEventToTags + cache.invalidate({tags}) for partial purge.
//
// The NestJS sender (WebhookDispatchService) POSTs {event, payload, timestamp}
// with an X-Revalidate-Signature header. Invalid signature or stale timestamp → 401.
// Only the mapped tags are purged (R-ISR-05) — non-purged tags keep their cache.

import type { APIRoute } from 'astro';
import {
  verifyWebhookSignature,
  isTimestampFresh,
  mapEventToTags,
  type RevalidateBody,
} from '../../lib/revalidate-hmac';

const REVALIDATE_SECRET =
  import.meta.env.REVALIDATE_SECRET || process.env.REVALIDATE_SECRET;

export const POST: APIRoute = async ({ request, cache }) => {
  const signature = request.headers.get('x-revalidate-signature') ?? undefined;
  const rawBody = await request.text();

  // R-ISR-03: verify HMAC-SHA256 with timingSafeEqual. Missing/invalid → 401.
  if (!verifyWebhookSignature(signature, rawBody, REVALIDATE_SECRET ?? '')) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: RevalidateBody;
  try {
    body = JSON.parse(rawBody) as RevalidateBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // R-ISR-03: reject timestamps older than 5 minutes.
  if (!isTimestampFresh(body.timestamp)) {
    return new Response(JSON.stringify({ error: 'Stale timestamp' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // R-ISR-04/05: map event→tags and purge ONLY the mapped tags.
  const tags = mapEventToTags(body.event, body.payload);
  let purged: string[] = [];

  try {
    // Astro 7 SSR: invalidate cached entries by tag (R-ISR-05).
    await cache.invalidate({ tags });
    purged = tags;
  } catch {
    // Cache provider may not be configured (dev) — safe to ignore.
  }

  return new Response(JSON.stringify({ ok: true, purged }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};