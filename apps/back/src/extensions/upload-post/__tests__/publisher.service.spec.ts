import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { UploadPostPublisherService } from '../services/publisher.service';
import { UploadService } from '../services/upload.service';
import { FilesService } from '@storage/files/files.service';
import {
  PLATFORM_CAPABILITIES,
  type PlatformCapability,
  type UpMediaType,
  type PublishRequest,
} from '../services/publisher.service';
import type { UpPostEntity } from '../infrastructure/persistence/entities/up-post.entity';

const mockUploadService = () => ({
  uploadVideo: vi.fn(),
  uploadPhotos: vi.fn(),
  uploadText: vi.fn(),
  uploadDocument: vi.fn(),
});

const mockRepo = () => ({
  find: vi.fn((): UpPostEntity[] => []),
  create: vi.fn((x: UpPostEntity) => x),
  save: vi.fn((e: UpPostEntity) => e),
});

describe('UploadPostPublisherService', () => {
  let service: UploadPostPublisherService;
  let uploads: ReturnType<typeof mockUploadService>;
  let repo: ReturnType<typeof mockRepo>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    repo = mockRepo();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UploadPostPublisherService,
        { provide: UploadService, useValue: mockUploadService() },
        { provide: 'UpPostEntityRepository', useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(UploadPostPublisherService);
    uploads = moduleRef.get(UploadService);
  });

  describe('renderTemplate', () => {
    it('should interpolate known vars', () => {
      const out = service.renderTemplate('{{title}} — {{link}}', {
        title: 'Launch',
        link: 'https://x.co',
      });
      expect(out).toBe('Launch — https://x.co');
    });

    it('should replace missing var with empty string and warn', () => {
      const out = service.renderTemplate('Hello {{name}}!', {});
      expect(out).toBe('Hello !');
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should trim surrounding whitespace', () => {
      expect(service.renderTemplate('  plain text  ', {})).toBe('plain text');
    });

    it('should handle multiple occurrences and extra unused vars', () => {
      expect(
        service.renderTemplate('{{t}}{{t}}', { t: '-x-', unused: 'y' }),
      ).toBe('-x--x-');
    });
  });

  describe('presets', () => {
    it('should expose capability maps for key platforms', () => {
      expect(PLATFORM_CAPABILITIES.linkedin).toEqual<PlatformCapability>({
        aspectRatios: ['16:9', '1:1', '4:5'],
        mediaTypes: ['video', 'photos', 'text', 'document'],
        requiresDestination: 'linkedin_page',
      });
      expect(PLATFORM_CAPABILITIES.instagram.mediaTypes).toContain('photos');
      expect(PLATFORM_CAPABILITIES.instagram.mediaTypes).not.toContain(
        'document',
      );
      expect(PLATFORM_CAPABILITIES.tiktok).toBeDefined();
      expect(PLATFORM_CAPABILITIES.pinterest.requiresDestination).toBe(
        'pinterest_board',
      );
      expect(PLATFORM_CAPABILITIES.facebook.aspectRatios).toContain('16:9');
    });

    it('should return the same map through the service getter', () => {
      expect(service.presets).toBe(PLATFORM_CAPABILITIES);
    });
  });

  describe('publish — routing per mediaType', () => {
    const base = { platforms: ['linkedin'], caption: 'c' };

    it('should route video uploads and return requestId + localId', async () => {
      uploads.uploadVideo.mockResolvedValue({
        request_id: 'req-1',
        localId: 'local-1',
      });
      const res = await service.publish({
        ...base,
        mediaType: 'video',
        title: 'T',
      });
      expect(uploads.uploadVideo).toHaveBeenCalledTimes(1);
      expect(res.requestId).toBe('req-1');
      expect(res.localId).toBe('local-1');
    });

    it('should route photos with templated caption', async () => {
      uploads.uploadPhotos.mockResolvedValue({
        request_id: 'req-2',
        localId: 'local-2',
      });
      const res = await service.publish({
        ...base,
        platforms: ['instagram'],
        mediaType: 'photos',
        caption: 'shot {{place}}',
        templateVars: { place: 'CPH' },
      });
      expect(uploads.uploadPhotos).toHaveBeenCalledWith(
        expect.objectContaining({ caption: 'shot CPH' }),
      );
      expect(res.requestId).toBe('req-2');
    });

    it('should route text uploads', async () => {
      uploads.uploadText.mockResolvedValue({
        request_id: 'req-3',
        localId: 'local-3',
      });
      const res = await service.publish({
        ...base,
        platforms: ['x'],
        mediaType: 'text',
      });
      expect(uploads.uploadText).toHaveBeenCalledTimes(1);
      expect(res.requestId).toBe('req-3');
    });

    it('should route document uploads to uploadDocument', async () => {
      uploads.uploadDocument.mockResolvedValue({
        request_id: 'req-4',
        localId: 'local-4',
      });
      const res = await service.publish({
        ...base,
        mediaType: 'document',
        documentUrl: 'https://files.local/doc.pdf',
      });
      expect(uploads.uploadDocument).toHaveBeenCalledTimes(1);
      expect(res.requestId).toBe('req-4');
    });

    it('should resolve storage file URLs via FilesService before dispatch', async () => {
      const filesService = {
        findByIds: vi
          .fn()
          .mockResolvedValue([{ id: 'a', path: 'https://cdn/a.png' }]),
      };
      uploads.uploadPhotos.mockResolvedValue({ request_id: 'req-rs' });
      const moduleRef = await Test.createTestingModule({
        providers: [
          UploadPostPublisherService,
          { provide: UploadService, useValue: uploads },
          { provide: 'UpPostEntityRepository', useValue: repo },
          { provide: FilesService, useValue: filesService },
        ],
      }).compile();
      const svc = moduleRef.get(UploadPostPublisherService);
      await svc.publish({
        mediaType: 'photos',
        platforms: ['instagram'],
        storageFileIds: ['a'],
      });
      expect(filesService.findByIds).toHaveBeenCalledWith(['a']);
      expect(uploads.uploadPhotos).toHaveBeenCalledWith(
        expect.objectContaining({
          photoUrls: ['https://cdn/a.png'],
        }),
      );
    });

    it('should reject unknown mediaType with typed error', async () => {
      await expect(
        service.publish({ ...base, mediaType: 'hologram' as UpMediaType }),
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
    });

    it('should reject document posts listing non-linkedin platforms', async () => {
      await expect(
        service.publish({
          mediaType: 'document',
          platforms: ['linkedin', 'tiktok'],
        }),
      ).rejects.toMatchObject({ code: 'INVALID_PLATFORMS' });
    });

    it('should pass scheduledAt and addToQueue through to upload calls', async () => {
      uploads.uploadVideo.mockResolvedValue({ request_id: 'req-5' });
      await service.publish({
        ...base,
        mediaType: 'video',
        title: 'T',
        scheduledAt: '2026-09-01T10:00:00Z',
        addToQueue: true,
      });
      expect(uploads.uploadVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledDate: '2026-09-01T10:00:00Z',
          addToQueue: true,
        }),
      );
    });
  });

  describe('publish — idempotency', () => {
    const req: PublishRequest = {
      mediaType: 'photos',
      platforms: ['instagram'],
      caption: 'same post',
      profileUsername: 'acme',
      scheduledAt: '2026-09-02T10:00:00.000Z',
    };

    it('should return same requestId on identical republish and not dispatch twice', async () => {
      uploads.uploadPhotos.mockResolvedValue({ request_id: 'req-77' });
      const first = await service.publish(req);
      const existing = {
        id: 'local-9',
        requestId: 'req-77',
        mediaType: 'photos',
        platforms: ['instagram'],
        caption: 'same post',
        profileUsername: 'acme',
        scheduledAt: new Date('2026-09-02T10:00:00.000Z'),
        status: 'processing',
      } as unknown as UpPostEntity;
      repo.find.mockResolvedValue([existing]);

      const second = await service.publish(req);

      expect(uploads.uploadPhotos).toHaveBeenCalledTimes(1);
      expect(second.requestId).toBe('req-77');
      expect(second.localId).toBe('local-9');
      expect(second.requestId).toBe(first.requestId);
    });

    it('should treat different rendered captions as different logical requests', async () => {
      uploads.uploadPhotos
        .mockResolvedValueOnce({ request_id: 'req-78' })
        .mockResolvedValueOnce({ request_id: 'req-79' });
      await service.publish(req);
      const other = await service.publish({
        ...req,
        caption: 'same post {v}',
        templateVars: { v: 'x' },
      });
      expect(uploads.uploadPhotos).toHaveBeenCalledTimes(2);
      expect(other.requestId).toBe('req-79');
    });

    it('should allow re-dispatch when the previous attempt errored without requestId', async () => {
      uploads.uploadPhotos
        .mockResolvedValueOnce({ request_id: null })
        .mockResolvedValueOnce({ request_id: 'req-80' });
      await service.publish(req);
      const prior = {
        id: 'local-e',
        requestId: null,
        mediaType: 'photos',
        platforms: ['instagram'],
        caption: 'same post',
        profileUsername: 'acme',
        scheduledAt: new Date('2026-09-02T10:00:00.000Z'),
        status: 'error',
      } as unknown as UpPostEntity;
      repo.find.mockResolvedValue([prior]);
      const res = await service.publish(req);
      expect(uploads.uploadPhotos).toHaveBeenCalledTimes(2);
      expect(res.requestId).toBe('req-80');
    });
  });
});
