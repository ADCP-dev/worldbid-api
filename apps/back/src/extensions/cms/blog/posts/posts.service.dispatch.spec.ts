// RED (task 3.15): posts.service.dispatch.spec.ts
// Verifies BlogPostsService fires revalidate webhooks (R-CMS-A-01):
//   - update()    → fireRevalidateWebhook('post.updated', {id, slug})
//   - publish(id, true)  → fireRevalidateWebhook('post.published', {id, slug})
//   - publish(id, false) → fireRevalidateWebhook('post.unpublished', {id, slug})
//   - remove()    → fireRevalidateWebhook('post.deleted', {id, slug})
//   - CMS op completes even if the webhook throws (fire-and-forget, D-07)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BlogPostsService } from './posts.service';
import { BlogPostEntity } from './infrastructure/entities/blog-post.entity';
import { TagEntity } from './infrastructure/entities/post-tag.entity';
import { TranslationEntity } from '@src/modules/translations/infrastructure/entities/translation.entity';
import { FilesService } from '@storage/files/files.service';
import { WebhookDispatchService } from '@ext/web/webhook-dispatch.service';
import type { RevalidateEvent } from '@ext/web/webhook-dispatch.service';

describe('BlogPostsService — revalidate webhook dispatch (R-CMS-A-01)', () => {
  let service: BlogPostsService;
  let dispatch: { fireRevalidateWebhook: jest.Mock };
  let blogPostRepository: {
    findOne: jest.Mock;
    findAndCount: jest.Mock;
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    create: jest.Mock;
  };
  let tagRepository: { findBy: jest.Mock };
  let translationRepository: { find: jest.Mock };
  let filesService: { findWithFilters: jest.Mock; delete: jest.Mock };

  const POST_ID = 'post-1';
  const POST_SLUG = 'hello-world';

  const basePost = {
    id: POST_ID,
    slug: POST_SLUG,
    categoryId: 'cat-1',
    isPublished: false,
    title: 'Hello',
    tags: [],
    featuredImage: null,
    author: null,
    category: null,
  };

  beforeEach(async () => {
    dispatch = { fireRevalidateWebhook: jest.fn().mockResolvedValue(undefined) };

    blogPostRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getMany: jest.fn().mockResolvedValue([]),
      }),
      save: jest.fn().mockImplementation(async (p: any) => ({ ...basePost, ...p })),
      remove: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((p: any) => ({ ...basePost, ...p })),
    };

    tagRepository = { findBy: jest.fn().mockResolvedValue([]) };
    translationRepository = { find: jest.fn().mockResolvedValue([]) };
    filesService = {
      findWithFilters: jest.fn().mockResolvedValue({ data: [] }),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogPostsService,
        { provide: getRepositoryToken(BlogPostEntity), useValue: blogPostRepository },
        { provide: getRepositoryToken(TagEntity), useValue: tagRepository },
        {
          provide: getRepositoryToken(TranslationEntity),
          useValue: translationRepository,
        },
        { provide: FilesService, useValue: filesService },
        { provide: 'FILE_UPLOADER_SERVICE', useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: WebhookDispatchService, useValue: dispatch },
      ],
    }).compile();

    service = module.get<BlogPostsService>(BlogPostsService);
  });

  afterEach(() => jest.clearAllMocks());

  function expectDispatched(event: RevalidateEvent, id: string, slug: string) {
    expect(dispatch.fireRevalidateWebhook).toHaveBeenCalledTimes(1);
    const [evt, payload] = dispatch.fireRevalidateWebhook.mock.calls[0];
    expect(evt).toBe(event);
    expect(payload).toEqual(expect.objectContaining({ id, slug }));
  }

  describe('update', () => {
    it('should fire post.updated webhook with id + slug after update', async () => {
      blogPostRepository.findOne.mockResolvedValue({ ...basePost });
      await service.update(POST_ID, { title: 'Updated title' } as any);

      expectDispatched('post.updated', POST_ID, POST_SLUG);
    });
  });

  describe('publish', () => {
    it('should fire post.published webhook when publishing', async () => {
      blogPostRepository.findOne.mockResolvedValue({ ...basePost, isPublished: false });
      await service.publish(POST_ID, true);

      expectDispatched('post.published', POST_ID, POST_SLUG);
    });

    it('should fire post.unpublished webhook when unpublishing', async () => {
      blogPostRepository.findOne.mockResolvedValue({ ...basePost, isPublished: true });
      await service.publish(POST_ID, false);

      expectDispatched('post.unpublished', POST_ID, POST_SLUG);
    });
  });

  describe('remove', () => {
    it('should fire post.deleted webhook after remove', async () => {
      blogPostRepository.findOne.mockResolvedValue({ ...basePost });
      await service.remove(POST_ID);

      expectDispatched('post.deleted', POST_ID, POST_SLUG);
    });

    it('should complete remove even if the webhook rejects (fire-and-forget, D-07)', async () => {
      blogPostRepository.findOne.mockResolvedValue({ ...basePost });
      dispatch.fireRevalidateWebhook.mockRejectedValue(new Error('Astro down'));

      await expect(service.remove(POST_ID)).resolves.toBeUndefined();
      expect(dispatch.fireRevalidateWebhook).toHaveBeenCalledTimes(1);
    });
  });
});