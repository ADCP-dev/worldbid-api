import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UploadService } from '../services/upload.service';
import { UploadPostClientService } from '../services/upload-post-client.service';
import { UpPostEntity } from '../infrastructure/persistence/entities/up-post.entity';

describe('UploadService — WU1 persistence additions', () => {
  let service: UploadService;
  let client: {
    uploadVideo: ReturnType<typeof vi.fn>;
    uploadPhotos: ReturnType<typeof vi.fn>;
    uploadText: ReturnType<typeof vi.fn>;
    uploadDocument: ReturnType<typeof vi.fn>;
    getUploadStatus: ReturnType<typeof vi.fn>;
    profileUsername: string | undefined;
  };
  let repo: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    client = {
      uploadVideo: vi.fn(),
      uploadPhotos: vi.fn(),
      uploadText: vi.fn(),
      uploadDocument: vi.fn(),
      getUploadStatus: vi.fn(),
      profileUsername: 'acme',
    };
    repo = {
      create: vi.fn((x: UpPostEntity) => x),
      save: vi.fn((e: UpPostEntity) => {
        e.id ??= `local-${Math.random().toString(36).slice(2, 9)}`;
        return e;
      }),
      findOne: vi.fn(() => null),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: UploadPostClientService, useValue: client },
        {
          provide: getRepositoryToken(UpPostEntity),
          useValue: repo,
        },
      ],
    }).compile();
    service = moduleRef.get(UploadService);
  });

  describe('uploadText persistence (C15)', () => {
    it('should persist a local row with requestId, mediaType text and content', async () => {
      client.uploadText.mockResolvedValue({
        success: true,
        request_id: 'req-t1',
      });

      const result = await service.uploadText({
        user: 'acme',
        platforms: ['x', 'threads'],
        text: 'hello world',
        title: 'T',
      });

      expect(client.uploadText).toHaveBeenCalledTimes(1);
      expect(result.requestId).toBe('req-t1');
      expect(result.localId).toBeDefined();

      const created = repo.create.mock.calls[0]?.[0] as unknown as UpPostEntity;
      expect(created.mediaType).toBe('text');
      expect(created.caption).toBe('hello world');
      expect(created.platforms).toEqual(['x', 'threads']);
      expect(created.status).toBe('processing');
      expect(created.requestId).toBe('req-t1');
    });

    it('should mark row error and rethrow when upstream fails', async () => {
      client.uploadText.mockRejectedValue(new Error('boom'));

      await expect(
        service.uploadText({ user: 'acme', platforms: ['x'], text: 'nope' }),
      ).rejects.toThrow('boom');

      const saved = repo.save.mock.calls.at(-1)?.[0] as unknown as UpPostEntity;
      expect(saved.status).toBe('error');
      expect(saved.errorMessage).toBe('boom');
    });
  });

  describe('uploadDocument (C2/C15)', () => {
    it('should persist document row and gate platforms to linkedin upstream', async () => {
      client.uploadDocument.mockResolvedValue({
        success: true,
        request_id: 'req-d1',
      });

      const result = await service.uploadDocument({
        user: 'acme',
        platforms: ['linkedin'],
        documentUrl: 'https://cdn/doc.pdf',
        title: 'Deck',
        caption: 'look',
      });

      expect(client.uploadDocument).toHaveBeenCalledWith(
        expect.objectContaining({ platforms: ['linkedin'] }),
      );
      expect(result.requestId).toBe('req-d1');

      const created = repo.create.mock.calls[0]?.[0] as unknown as UpPostEntity;
      expect(created.mediaType).toBe('document');
      expect(created.mediaUrl).toBe('https://cdn/doc.pdf');
      expect(created.title).toBe('Deck');
    });

    it('should reject non-linkedin platforms before dispatch', async () => {
      await expect(
        service.uploadDocument({
          user: 'acme',
          platforms: ['linkedin', 'tiktok'],
          documentUrl: 'https://cdn/doc.pdf',
          title: 'Deck',
        }),
      ).rejects.toMatchObject({
        code: 'INVALID_PLATFORMS',
      });
      expect(client.uploadDocument).not.toHaveBeenCalled();
    });

    it('should mark row error on upstream failure', async () => {
      client.uploadDocument.mockRejectedValue(new Error('linkedin down'));

      await expect(
        service.uploadDocument({
          user: 'acme',
          platforms: ['linkedin'],
          documentUrl: 'https://cdn/doc.pdf',
          title: 'D',
        }),
      ).rejects.toThrow('linkedin down');

      const saved = repo.save.mock.calls.at(-1)?.[0] as unknown as UpPostEntity;
      expect(saved.status).toBe('error');
    });
  });

  describe('document ⇒ linkedin server-side validation (C1)', () => {
    it('should uploadVideo still allows multiple platforms (no regression)', async () => {
      client.uploadVideo.mockResolvedValue({ request_id: 'req-v9' });
      await service.uploadVideo({
        title: 'V',
        platforms: ['tiktok', 'youtube'],
        videoUrl: 'https://cdn/v.mp4',
      });
      expect(client.uploadVideo).toHaveBeenCalledTimes(1);
      const created = repo.create.mock.calls[0]?.[0] as unknown as UpPostEntity;
      expect(created.mediaType).toBe('video');
    });
  });
});
