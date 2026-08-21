// RED (task 3.17): pages.service.dispatch.spec.ts
// Verifies PagesService fires revalidate webhooks (R-CMS-A-02):
//   - update()  → fireRevalidateWebhook('page.updated', {id, slug, pageSection})
//   - publish() → fireRevalidateWebhook('page.updated', {id, slug, pageSection})
//   - remove()  → fireRevalidateWebhook('page.updated', {id, slug, pageSection})
//   - when pageSection === 'landing', payload includes pageSection='landing'
//     (the receiver maps this to ['pages','sitemap','home'])
//   - CMS op completes even if the webhook throws (fire-and-forget, D-07)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { PagesService } from './pages.service';
import { PageEntity } from './infrastructure/entities/page.entity';
import { TranslationEntity } from '@src/modules/translations/infrastructure/entities/translation.entity';
import { TranslationsService } from '@src/modules/translations/translations.service';
import { SeoService } from '../seo/seo.service';
import { FilesService } from '@storage/files/files.service';
import { WebhookDispatchService } from '@ext/web/webhook-dispatch.service';

describe('PagesService — revalidate webhook dispatch (R-CMS-A-02)', () => {
  let service: PagesService;
  let dispatch: { fireRevalidateWebhook: jest.Mock };
  let pageRepository: {
    findOne: jest.Mock;
    findAndCount: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    update: jest.Mock;
  };
  let translationRepository: { find: jest.Mock };
  let filesService: { findWithFilters: jest.Mock; delete: jest.Mock };

  const PAGE_ID = 'page-1';
  const PAGE_SLUG = 'about';
  const PAGE_SECTION = 'about';

  const basePage = {
    id: PAGE_ID,
    slug: PAGE_SLUG,
    name: PAGE_SECTION,
    isPublished: false,
    featuredImage: null,
    author: null,
    order: 0,
    parentId: null,
  };

  beforeEach(async () => {
    dispatch = { fireRevalidateWebhook: jest.fn().mockResolvedValue(undefined) };

    pageRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      save: jest.fn().mockImplementation(async (p: any) => ({ ...basePage, ...p })),
      remove: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    translationRepository = { find: jest.fn().mockResolvedValue([]) };
    filesService = {
      findWithFilters: jest.fn().mockResolvedValue({ data: [] }),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        { provide: getRepositoryToken(PageEntity), useValue: pageRepository },
        {
          provide: getRepositoryToken(TranslationEntity),
          useValue: translationRepository,
        },
        {
          provide: TranslationsService,
          useValue: {
            getTranslationsForCategory: jest.fn().mockResolvedValue({}),
            createTranslation: jest.fn().mockResolvedValue({}),
          },
        },
        { provide: SeoService, useValue: { findByPageId: jest.fn().mockResolvedValue(null) } },
        { provide: FilesService, useValue: filesService },
        { provide: WebhookDispatchService, useValue: dispatch },
      ],
    }).compile();

    service = module.get<PagesService>(PagesService);
  });

  afterEach(() => jest.clearAllMocks());

  function expectPageDispatched(pageSection: string) {
    expect(dispatch.fireRevalidateWebhook).toHaveBeenCalledTimes(1);
    const [event, payload] = dispatch.fireRevalidateWebhook.mock.calls[0];
    expect(event).toBe('page.updated');
    expect(payload).toEqual(
      expect.objectContaining({ id: PAGE_ID, slug: PAGE_SLUG, pageSection }),
    );
  }

  describe('update', () => {
    it('should fire page.updated webhook with id + slug + pageSection after update', async () => {
      pageRepository.findOne.mockResolvedValue({ ...basePage });
      await service.update(PAGE_ID, { title: 'Updated' } as any);

      expectPageDispatched(PAGE_SECTION);
    });

    it('should include pageSection="landing" when the page name is "landing"', async () => {
      pageRepository.findOne.mockResolvedValue({ ...basePage, name: 'landing' });
      await service.update(PAGE_ID, { title: 'Updated' } as any);

      expectPageDispatched('landing');
    });
  });

  describe('publish', () => {
    it('should fire page.updated webhook on publish', async () => {
      pageRepository.findOne.mockResolvedValue({ ...basePage, isPublished: false });
      await service.publish(PAGE_ID, true);

      expectPageDispatched(PAGE_SECTION);
    });

    it('should fire page.updated webhook on unpublish', async () => {
      pageRepository.findOne.mockResolvedValue({ ...basePage, isPublished: true });
      await service.publish(PAGE_ID, false);

      expectPageDispatched(PAGE_SECTION);
    });
  });

  describe('remove', () => {
    it('should fire page.updated webhook after remove', async () => {
      pageRepository.findOne.mockResolvedValue({ ...basePage });
      await service.remove(PAGE_ID);

      expectPageDispatched(PAGE_SECTION);
    });

    it('should complete remove even if the webhook rejects (fire-and-forget, D-07)', async () => {
      pageRepository.findOne.mockResolvedValue({ ...basePage });
      dispatch.fireRevalidateWebhook.mockRejectedValue(new Error('Astro down'));

      await expect(service.remove(PAGE_ID)).resolves.toBeUndefined();
      expect(dispatch.fireRevalidateWebhook).toHaveBeenCalledTimes(1);
    });
  });
});