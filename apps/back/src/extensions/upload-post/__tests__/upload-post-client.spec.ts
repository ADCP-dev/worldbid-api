import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { UPLOAD_POST_PROVIDER } from '../upload-post.provider';
import { UploadPostClientService } from '../services/upload-post-client.service';
import type { UploadPostConfig } from '../config/upload-post-config.type';

const CFG: UploadPostConfig = {
  apiKey: 'test-key',
  apiUrl: 'https://api.upload-post.com',
  profileUsername: 'acme',
};

describe('UploadPostClientService — WU1 additions', () => {
  let client: UploadPostClientService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchSpy = vi.fn(
      () =>
        new Response(JSON.stringify({ success: true, request_id: 'r-1' }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: UPLOAD_POST_PROVIDER, useValue: CFG },
        UploadPostClientService,
      ],
    }).compile();
    client = moduleRef.get(UploadPostClientService);
  });

  const lastCall = () => {
    const call = fetchSpy.mock.calls.at(-1) as unknown as [string, RequestInit];
    return {
      url: new URL(call[0]),
      init: call[1],
    };
  };

  describe('uploadDocument', () => {
    it('should POST multipart to /api/upload_document with document fields', async () => {
      await client.uploadDocument({
        user: 'acme',
        platforms: ['linkedin'],
        documentUrl: 'https://cdn/doc.pdf',
        title: 'Deck',
        caption: 'look',
      });
      const { url, init } = lastCall();
      expect(url.pathname).toBe('/api/upload_document');
      expect(url.origin).toBe('https://api.upload-post.com');
      expect(init.method).toBe('POST');
      const fd = init.body as FormData;
      expect(fd).toBeInstanceOf(FormData);
      expect(fd.get('user')).toBe('acme');
      expect(fd.getAll('platform[]')).toEqual(['linkedin']);
      expect(fd.get('document')).toBe('https://cdn/doc.pdf');
      expect(fd.get('title')).toBe('Deck');
      expect(fd.get('description')).toBe('look');
    });

    it('should append documentBuffer as Blob with filename', async () => {
      const buf = Buffer.from('pdf-bytes');
      await client.uploadDocument({
        user: 'acme',
        platforms: ['linkedin'],
        documentBuffer: buf,
        documentFilename: 'deck.pdf',
        title: 'Deck',
      });
      const { init } = lastCall();
      const fd = init.body as FormData;
      const file = fd.get('document');
      expect(file).toBeInstanceOf(Blob);
      expect((file as Blob).size).toBe(buf.length);
    });

    it('should forward scheduledDate and asyncUpload flags', async () => {
      await client.uploadDocument({
        user: 'acme',
        platforms: ['linkedin'],
        documentUrl: 'https://cdn/doc.pdf',
        title: 'Deck',
        scheduledDate: '2026-09-01T10:00:00Z',
        asyncUpload: true,
      });
      const { init } = lastCall();
      const fd = init.body as FormData;
      expect(fd.get('scheduled_date')).toBe('2026-09-01T10:00:00Z');
      expect(fd.get('async_upload')).toBe('true');
    });
  });

  describe('post actions', () => {
    it('should retryUpload should POST /api/uploadposts/posts/retry with request_id', async () => {
      await client.retryUpload({ requestId: 'req-9' });
      const { url, init } = lastCall();
      expect(url.pathname).toBe('/api/uploadposts/posts/retry');
      expect(init.method).toBe('POST');
      expect(JSON.parse(String(init.body))).toEqual({ request_id: 'req-9' });
    });

    it('should retryUpload should accept jobId variant', async () => {
      await client.retryUpload({ jobId: 'job-3' });
      const { url, init } = lastCall();
      expect(url.pathname).toBe('/api/uploadposts/posts/retry');
      expect(JSON.parse(String(init.body))).toEqual({ job_id: 'job-3' });
    });

    it('should unpublishPost should POST /api/uploadposts/posts/unpublish with platform+user+post_id', async () => {
      await client.unpublishPost({
        platform: 'linkedin',
        postId: 'urn:li:share:1',
      });
      const { url, init } = lastCall();
      expect(url.pathname).toBe('/api/uploadposts/posts/unpublish');
      expect(JSON.parse(String(init.body))).toEqual({
        platform: 'linkedin',
        user: 'acme',
        post_id: 'urn:li:share:1',
      });
    });
  });

  describe('unified comments', () => {
    it('should createComment should POST /api/uploadposts/comments/create', async () => {
      await client.createComment({
        platform: 'youtube',
        user: 'acme',
        postId: 'vid-1',
        message: 'nice',
      });
      const { url, init } = lastCall();
      expect(url.pathname).toBe('/api/uploadposts/comments/create');
      expect(JSON.parse(String(init.body))).toEqual({
        platform: 'youtube',
        user: 'acme',
        post_id: 'vid-1',
        message: 'nice',
      });
    });

    it('should createComment should include commentId for replies', async () => {
      await client.createComment({
        platform: 'instagram',
        user: 'acme',
        commentId: 'c-1',
        message: 'reply!',
      });
      const { url, init } = lastCall();
      expect(url.pathname).toBe('/api/uploadposts/comments/create');
      expect(JSON.parse(String(init.body))).toMatchObject({
        comment_id: 'c-1',
        message: 'reply!',
      });
    });

    it('should deleteComment should POST /api/uploadposts/comments/delete', async () => {
      await client.deleteComment({
        platform: 'facebook',
        user: 'acme',
        commentId: 'c-9',
      });
      const { url, init } = lastCall();
      expect(url.pathname).toBe('/api/uploadposts/comments/delete');
      expect(JSON.parse(String(init.body))).toEqual({
        platform: 'facebook',
        user: 'acme',
        comment_id: 'c-9',
      });
    });
  });

  describe('queue params passthrough on uploads', () => {
    it('should uploadVideo should forward add_to_queue', async () => {
      await client.uploadVideo({
        title: 'V',
        user: 'acme',
        platforms: ['tiktok'],
        videoUrl: 'https://cdn/v.mp4',
        addToQueue: true,
      });
      const { init } = lastCall();
      const fd = init.body as FormData;
      expect(url_pathOfLast(fetchSpy)).toBe('/api/upload');
      expect(fd.get('add_to_queue')).toBe('true');
    });

    it('should uploadPhotos should forward add_to_queue and timezone', async () => {
      await client.uploadPhotos({
        user: 'acme',
        platforms: ['instagram'],
        photoUrls: ['https://cdn/a.jpg'],
        addToQueue: true,
        timezone: 'Europe/Madrid',
      });
      const { url, init } = lastCall();
      expect(url.pathname).toBe('/api/upload_photos');
      const fd = init.body as FormData;
      expect(fd.get('add_to_queue')).toBe('true');
      expect(fd.get('timezone')).toBe('Europe/Madrid');
    });

    it('should uploadText should forward add_to_queue and keep platform[] shape', async () => {
      await client.uploadText({
        user: 'acme',
        platforms: ['x'],
        text: 'hi',
        addToQueue: true,
      });
      const { url, init } = lastCall();
      expect(url.pathname).toBe('/api/upload_text');
      const fd = init.body as FormData;
      expect(fd.get('add_to_queue')).toBe('true');
    });
  });

  describe('document LinkedIn gate', () => {
    it('should uploadDocument should reject non-linkedin platforms client-side', async () => {
      await expect(
        client.uploadDocument({
          user: 'acme',
          platforms: ['tiktok'],
          documentUrl: 'https://cdn/doc.pdf',
          title: 'D',
        }),
      ).rejects.toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('account /me (W2 remediation)', () => {
    it('should GET /api/uploadposts/me with auth header and return payload', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ plan: 'pro', usage: { used: 3 } }), {
          status: 200,
        }),
      );
      const res = await client.getCurrentUser();
      expect(res).toEqual({ plan: 'pro', usage: { used: 3 } });
      const { url, init } = lastCall();
      expect(url.pathname).toBe('/api/uploadposts/me');
      expect(init.method).toBe('GET');
      expect((init.headers as Record<string, string>).Authorization).toMatch(
        /^Apikey /,
      );
    });
  });
});

function url_pathOfLast(fetchMock: { mock: { calls: unknown[][] } }): string {
  const call = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
  return new URL(call[0]).pathname;
}
