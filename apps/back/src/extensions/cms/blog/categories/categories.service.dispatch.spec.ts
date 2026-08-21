// RED (task 3.19): categories.service.dispatch.spec.ts
// Verifies BlogCategoriesService fires revalidate webhooks (R-CMS-A-03):
//   - update() → fireRevalidateWebhook('category.updated', {id, slug})
//   - CMS op completes even if the webhook throws (fire-and-forget, D-07)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogCategoriesService } from './categories.service';
import { BlogCategoryEntity } from './infrastructure/entities/blog-category.entity';
import { TagEntity } from '../posts/infrastructure/entities/post-tag.entity';
import { TranslationsService } from '@src/modules/translations/translations.service';
import { WebhookDispatchService } from '@ext/web/webhook-dispatch.service';

describe('BlogCategoriesService — revalidate webhook dispatch (R-CMS-A-03)', () => {
  let service: BlogCategoriesService;
  let dispatch: { fireRevalidateWebhook: jest.Mock };
  let categoryRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    create: jest.Mock;
  };

  const CAT_ID = 'cat-1';
  const CAT_SLUG = 'technology';

  const baseCategory = {
    id: CAT_ID,
    slug: CAT_SLUG,
    name: 'Technology',
    order: 0,
    parentId: null,
    tags: [],
  };

  beforeEach(async () => {
    dispatch = { fireRevalidateWebhook: jest.fn().mockResolvedValue(undefined) };

    categoryRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation(async (c: any) => ({ ...baseCategory, ...c })),
      remove: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((c: any) => ({ ...baseCategory, ...c })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogCategoriesService,
        {
          provide: getRepositoryToken(BlogCategoryEntity),
          useValue: categoryRepository,
        },
        { provide: getRepositoryToken(TagEntity), useValue: { findBy: jest.fn().mockResolvedValue([]) } },
        {
          provide: TranslationsService,
          useValue: {
            createTranslation: jest.fn().mockResolvedValue({}),
            getTranslationsForEntity: jest.fn().mockResolvedValue({}),
          },
        },
        { provide: WebhookDispatchService, useValue: dispatch },
      ],
    }).compile();

    service = module.get<BlogCategoriesService>(BlogCategoriesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('update', () => {
    it('should fire category.updated webhook with id + slug after update', async () => {
      categoryRepository.findOne.mockResolvedValue({ ...baseCategory });
      await service.update(CAT_ID, { name: 'Tech News' } as any);

      expect(dispatch.fireRevalidateWebhook).toHaveBeenCalledTimes(1);
      const [event, payload] = dispatch.fireRevalidateWebhook.mock.calls[0];
      expect(event).toBe('category.updated');
      expect(payload).toEqual(expect.objectContaining({ id: CAT_ID, slug: CAT_SLUG }));
    });

    it('should complete update even if the webhook rejects (fire-and-forget, D-07)', async () => {
      categoryRepository.findOne.mockResolvedValue({ ...baseCategory });
      dispatch.fireRevalidateWebhook.mockRejectedValue(new Error('Astro down'));

      await expect(service.update(CAT_ID, { name: 'X' } as any)).resolves.toBeDefined();
      expect(dispatch.fireRevalidateWebhook).toHaveBeenCalledTimes(1);
    });
  });
});