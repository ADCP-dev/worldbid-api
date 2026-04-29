import { APP_URL, ADMIN_EMAIL, ADMIN_PASSWORD } from '../utils/constants';
import request from 'supertest';

describe('CMS Tags Module', () => {
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

  describe('POST /cms/tags', () => {
    it('should create a new tag', async () => {
      const tagName = `Tag-${Date.now()}`;

      return request(app)
        .post('/api/v1/cms/tags')
        .auth(adminApiToken, { type: 'bearer' })
        .send({ name: tagName, slug: tagName.toLowerCase() })
        .expect(201)
        .expect(({ body }) => {
          expect(body.id).toBeDefined();
          expect(body.slug).toBe(tagName.toLowerCase());
        });
    });

    it('should fail without admin role', async () => {
      return request(app)
        .post('/api/v1/cms/tags')
        .send({ name: 'Unauthorized' })
        .expect(401);
    });
  });

  describe('GET /cms/tags', () => {
    it('should list tags with pagination', async () => {
      return request(app)
        .get('/api/v1/cms/tags')
        .auth(adminApiToken, { type: 'bearer' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toBeDefined();
          expect(body.meta).toBeDefined();
          expect(body.meta.page).toBeDefined();
          expect(body.meta.limit).toBeDefined();
          expect(body.meta.total).toBeDefined();
          expect(body.meta.totalPages).toBeDefined();
        });
    });
  });

  describe('PATCH /cms/tags/:id', () => {
    it('should update an existing tag', async () => {
      const tagName = `UpdateTag-${Date.now()}`;
      const updatedName = `Updated-${Date.now()}`;

      const created = await request(app)
        .post('/api/v1/cms/tags')
        .auth(adminApiToken, { type: 'bearer' })
        .send({ name: tagName, slug: tagName.toLowerCase() })
        .expect(201);

      return request(app)
        .patch(`/api/v1/cms/tags/${created.body.id}`)
        .auth(adminApiToken, { type: 'bearer' })
        .send({ name: updatedName })
        .expect(200)
        .expect(({ body }) => {
          expect(body.id).toBe(created.body.id);
        });
    });

    it('should fail without admin role', async () => {
      return request(app)
        .patch('/api/v1/cms/tags/non-existent-id')
        .send({ name: 'Hack' })
        .expect(401);
    });
  });

  describe('DELETE /cms/tags/:id', () => {
    it('should soft-delete an existing tag', async () => {
      const tagName = `DeleteTag-${Date.now()}`;

      const created = await request(app)
        .post('/api/v1/cms/tags')
        .auth(adminApiToken, { type: 'bearer' })
        .send({ name: tagName, slug: tagName.toLowerCase() })
        .expect(201);

      await request(app)
        .delete(`/api/v1/cms/tags/${created.body.id}`)
        .auth(adminApiToken, { type: 'bearer' })
        .expect(204);

      // Verify the tag is soft-deleted (findOne should return 404)
      return request(app)
        .get(`/api/v1/cms/tags/${created.body.id}`)
        .auth(adminApiToken, { type: 'bearer' })
        .expect(404);
    });

    it('should fail without admin role', async () => {
      return request(app)
        .delete('/api/v1/cms/tags/non-existent-id')
        .expect(401);
    });
  });

  describe('GET /cms/blog/posts/public/category/:categoryId', () => {
    it('should filter public posts by category', async () => {
      // This endpoint is public (no auth required)
      return request(app)
        .get('/api/v1/cms/blog/posts/public/category/some-category-id')
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toBeDefined();
          expect(body.meta).toBeDefined();
        });
    });
  });
});
