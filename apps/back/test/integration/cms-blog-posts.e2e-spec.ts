import { APP_URL, ADMIN_EMAIL, ADMIN_PASSWORD } from '../utils/constants';
import request from 'supertest';
import path from 'path';
import fs from 'fs';

describe('CMS Blog Posts Module', () => {
  const app = APP_URL;
  let adminApiToken: string;

  beforeAll(async () => {
    await request(app)
      .post('/api/v1/auth/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .then(({ body }) => {
        adminApiToken = body.token;
      });
  });

  describe('GET /cms/blog/posts/:id/preview', () => {
    it('should return hydrated data for an unpublished post', async () => {
      // Create an unpublished post first
      const postSlug = `preview-post-${Date.now()}`;
      const created = await request(app)
        .post('/api/v1/cms/blog/posts')
        .auth(adminApiToken, { type: 'bearer' })
        .send({
          slug: postSlug,
          isPublished: false,
        })
        .expect(201);

      return request(app)
        .get(`/api/v1/cms/blog/posts/${created.body.id}/preview`)
        .auth(adminApiToken, { type: 'bearer' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.id).toBe(created.body.id);
          expect(body.slug).toBe(postSlug);
          expect(body.title).toBeDefined();
          expect(body.content).toBeDefined();
          expect(body.isPublished).toBe(false);
          expect(body.featuredImage).toBeDefined();
          expect(body.tags).toBeDefined();
          expect(body.category).toBeDefined();
        });
    });

    it('should return 404 for non-existent post', async () => {
      return request(app)
        .get('/api/v1/cms/blog/posts/non-existent-id/preview')
        .auth(adminApiToken, { type: 'bearer' })
        .expect(404);
    });

    it('should require authentication', async () => {
      return request(app)
        .get('/api/v1/cms/blog/posts/some-id/preview')
        .expect(401);
    });
  });

  describe('POST /cms/blog/posts/:id/featured-image', () => {
    it('should upload a featured image for a post', async () => {
      // Create a post first
      const postSlug = `image-post-${Date.now()}`;
      const created = await request(app)
        .post('/api/v1/cms/blog/posts')
        .auth(adminApiToken, { type: 'bearer' })
        .send({
          slug: postSlug,
          isPublished: false,
        })
        .expect(201);

      // Create a temporary test image file
      const tmpDir = path.join(__dirname, '..', 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      const testImagePath = path.join(tmpDir, 'test-image.png');
      // Write a minimal 1x1 PNG
      const minimalPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );
      fs.writeFileSync(testImagePath, minimalPng);

      try {
        return request(app)
          .post(`/api/v1/cms/blog/posts/${created.body.id}/featured-image`)
          .auth(adminApiToken, { type: 'bearer' })
          .attach('file', testImagePath)
          .expect(200)
          .expect(({ body }) => {
            expect(body.url).toBeDefined();
            expect(body.fileId).toBeDefined();
          });
      } finally {
        // Cleanup temp file
        if (fs.existsSync(testImagePath)) {
          fs.unlinkSync(testImagePath);
        }
      }
    });

    it('should require authentication', async () => {
      return request(app)
        .post('/api/v1/cms/blog/posts/some-id/featured-image')
        .expect(401);
    });
  });
});
