import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WebhooksService } from '../services/webhooks.service';
import { UploadPostClientService } from '../services/upload-post-client.service';
import { UpPostEntity } from '../infrastructure/persistence/entities/up-post.entity';
import type { WebhookPayload } from '../services/webhooks.service';

describe('WebhooksService — upload_completed sync (C14/D5)', () => {
  let service: WebhooksService;
  let repo: {
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  const makeLocal = (): UpPostEntity =>
    ({
      id: 'local-1',
      requestId: 'req-w1',
      jobId: null,
      mediaType: 'video',
      platforms: ['tiktok', 'youtube'],
      status: 'processing',
      results: null,
    }) as UpPostEntity;

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    repo = {
      findOne: vi.fn(() => null),
      save: vi.fn((e: UpPostEntity) => e),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: UploadPostClientService,
          useValue: { configureWebhooks: vi.fn() },
        },
        { provide: getRepositoryToken(UpPostEntity), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(WebhooksService);
  });

  it('should sync per-platform results and flip to success when all platforms done', async () => {
    const local = makeLocal();
    repo.findOne.mockResolvedValue(local);
    const payload: WebhookPayload = {
      event: 'upload_completed',
      request_id: 'req-w1',
      platform: 'tiktok',
      result: { success: true, url: 'https://tiktok.com/x', publish_id: 'p-1' },
    };

    await service.handleWebhookEvent(payload);

    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ requestId: 'req-w1' }),
      }),
    );
    expect(local.results?.tiktok).toMatchObject({
      success: true,
      url: 'https://tiktok.com/x',
      publishId: 'p-1',
    });
    // youtube still pending → stays processing
    expect(local.status).toBe('processing');

    // final platform reports success → all done → success
    await service.handleWebhookEvent({
      event: 'upload_completed',
      request_id: 'req-w1',
      platform: 'youtube',
      result: { success: true, url: 'https://yt.com/1' },
    });
    expect(local.status).toBe('success');
    expect(local.publishedAt).toBeInstanceOf(Date);
  });

  it('should persist failure cause per platform', async () => {
    const local = makeLocal();
    repo.findOne.mockResolvedValue(local);
    const payload: WebhookPayload = {
      event: 'upload_completed',
      request_id: 'req-w1',
      platform: 'youtube',
      result: { success: false, error: 'quota exceeded' },
    };

    await service.handleWebhookEvent(payload);

    expect(local.results?.youtube).toMatchObject({
      success: false,
      error: 'quota exceeded',
    });
    expect(local.status).toBe('processing');
  });

  it('should flip status to error only when every platform failed', async () => {
    const local = makeLocal();
    local.platforms = ['youtube'];
    repo.findOne.mockResolvedValue(local);
    await service.handleWebhookEvent({
      event: 'upload_completed',
      request_id: 'req-w1',
      platform: 'youtube',
      result: { success: false, error: 'boom' },
    });
    expect(local.status).toBe('error');
    expect(local.errorMessage).toBe('boom');
  });

  it('should match by job_id when request_id is absent (scheduled)', async () => {
    const local = makeLocal();
    local.requestId = null;
    local.jobId = 'job-w2';
    repo.findOne.mockResolvedValue(local);
    await service.handleWebhookEvent({
      event: 'upload_completed',
      job_id: 'job-w2',
      platform: 'tiktok',
      result: { success: true, url: 'https://t.co/1' },
    });
    // single-platform job → allDone → success
    local.platforms = ['tiktok'];
    await service.handleWebhookEvent({
      event: 'upload_completed',
      job_id: 'job-w2',
      platform: 'tiktok',
      result: { success: true, url: 'https://t.co/1' },
    });
    expect(local.status).toBe('success');
  });

  it('should be a no-op when no local record matches', async () => {
    repo.findOne.mockResolvedValue(null);
    const res = await service.handleWebhookEvent({
      event: 'upload_completed',
      request_id: 'req-unknown',
      platform: 'tiktok',
      result: { success: true },
    });
    expect(res.received).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
