import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { WebConfig } from './web-config.type';

// Events the Astro receiver knows how to map to cache tags (R-ISR-04).
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
  categoryId?: string | null;
  tagSlugs?: string[];
  pageSection?: string;
  [key: string]: unknown;
}

interface RevalidateBody {
  event: RevalidateEvent;
  payload: RevalidatePayload;
  timestamp: string; // ISO 8601
}

/**
 * Fire-and-forget revalidate webhook sender (R-CMS-A-05, D-05, D-07).
 *
 * POSTs `{event, payload, timestamp}` HMAC-SHA256-signed with `REVALIDATE_SECRET`
 * to `<ASTRO_URL>/api/revalidate`. Mirrors the OutboundWebhookSigner.sign() pattern
 * (D-05) but standalone (no spec-engine machinery).
 *
 * NEVER throws — a webhook failure MUST NOT block the CMS admin operation (D-07).
 * No-op when REVALIDATE_SECRET or ASTRO_URL is not configured.
 */
@Injectable()
export class WebhookDispatchService {
  private readonly logger = new Logger(WebhookDispatchService.name);

  constructor(private readonly configService: ConfigService) {}

  async fireRevalidateWebhook(
    event: RevalidateEvent,
    payload: RevalidatePayload,
  ): Promise<void> {
    const config = this.configService.get<WebConfig>('web', { infer: true });
    const secret = config?.revalidateSecret;
    const astroUrl = config?.astroUrl;

    if (!secret || !astroUrl) {
      this.logger.debug(
        `Revalidate webhook skipped (event=${event}): REVALIDATE_SECRET or ASTRO_URL not configured`,
      );
      return;
    }

    const body: RevalidateBody = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    };
    const rawBody = JSON.stringify(body);

    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');

    try {
      const res = await fetch(`${astroUrl}/api/revalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Revalidate-Signature': signature,
        },
        body: rawBody,
      });

      if (!res.ok) {
        this.logger.warn(
          `Revalidate webhook to ${astroUrl}/api/revalidate failed with status ${res.status} (event=${event})`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Revalidate webhook to ${astroUrl}/api/revalidate failed: ${(err as Error).message} (event=${event})`,
      );
    }
  }
}