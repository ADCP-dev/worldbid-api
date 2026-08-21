// RED (task 3.13): webhook-dispatch.service.spec.ts
// Verifies WebhookDispatchService behavior (R-CMS-A-05, D-05, D-07):
//   - HMAC-SHA256 signing matches OutboundWebhookSigner.sign() pattern
//   - POSTs to <ASTRO_URL>/api/revalidate with X-Revalidate-Signature header
//   - Fire-and-forget: never throws (CMS op completes even if webhook fails)
//   - Logs warning on network/payload error
//   - No-op (skips fetch) when REVALIDATE_SECRET or ASTRO_URL not configured

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { WebhookDispatchService } from './webhook-dispatch.service';

describe('WebhookDispatchService', () => {
  let service: WebhookDispatchService;
  let configService: { get: jest.Mock };
  let fetchMock: jest.Mock;

  const SECRET = 'test-revalidate-secret';
  const ASTRO_URL = 'http://astro.local:4321';

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    (globalThis as any).fetch = fetchMock;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'web') {
          return { revalidateSecret: SECRET, astroUrl: ASTRO_URL };
        }
        return undefined;
      }),
    };

    return Test.createTestingModule({
      providers: [
        WebhookDispatchService,
        { provide: ConfigService, useValue: configService },
      ],
    })
      .compile()
      .then((m: TestingModule) => {
        service = m.get<WebhookDispatchService>(WebhookDispatchService);
      });
  });

  afterEach(() => {
    jest.clearAllMocks();
    (globalThis as any).fetch = undefined;
  });

  describe('fireRevalidateWebhook', () => {
    const event = 'post.updated' as const;
    const payload = { id: 'post-1', slug: 'hello-world', categoryId: 'cat-1' };

    it('should POST to <ASTRO_URL>/api/revalidate with a valid HMAC-SHA256 signature', async () => {
      await service.fireRevalidateWebhook(event, payload);

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${ASTRO_URL}/api/revalidate`);

      const body = JSON.parse(init.body as string);
      expect(body.event).toBe(event);
      expect(body.payload).toEqual(payload);
      expect(typeof body.timestamp).toBe('string');
      // ISO 8601 parseable
      expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);

      const expectedSig = createHmac('sha256', SECRET)
        .update(init.body as string)
        .digest('hex');
      expect(init.headers['X-Revalidate-Signature']).toBe(expectedSig);
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.method).toBe('POST');
    });

    it('should NOT throw and should log a warning when fetch rejects (fire-and-forget, D-07)', async () => {
      fetchMock.mockRejectedValue(new Error('Astro down'));

      // Must resolve, not reject — CMS op must complete regardless of webhook failure.
      await expect(service.fireRevalidateWebhook(event, payload)).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should NOT throw and should log a warning when fetch returns a non-ok status', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      await expect(service.fireRevalidateWebhook(event, payload)).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should be a no-op (skip fetch) when REVALIDATE_SECRET is not configured', async () => {
      configService.get.mockReturnValue({ revalidateSecret: undefined, astroUrl: ASTRO_URL });

      await service.fireRevalidateWebhook(event, payload);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should be a no-op (skip fetch) when ASTRO_URL is not configured', async () => {
      configService.get.mockReturnValue({ revalidateSecret: SECRET, astroUrl: undefined });

      await service.fireRevalidateWebhook(event, payload);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should use a fresh ISO 8601 timestamp on every call (no reuse)', async () => {
      await service.fireRevalidateWebhook(event, payload);
      // Yield to the event loop so the next timestamp is from a different millisecond.
      await new Promise((resolve) => setTimeout(resolve, 5));
      await service.fireRevalidateWebhook(event, payload);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const ts1 = JSON.parse(fetchMock.mock.calls[0][1].body).timestamp;
      const ts2 = JSON.parse(fetchMock.mock.calls[1][1].body).timestamp;
      // Both must be valid ISO 8601 and differ (timestamps are generated per call).
      expect(Number.isNaN(Date.parse(ts1))).toBe(false);
      expect(Number.isNaN(Date.parse(ts2))).toBe(false);
      expect(ts1).not.toBe(ts2);
    });
  });
});