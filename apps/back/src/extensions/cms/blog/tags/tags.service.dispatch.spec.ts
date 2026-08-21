// RED (task 3.21): tags.service.dispatch.spec.ts
// Verifies TagsService fires revalidate webhooks (R-CMS-A-04):
//   - update() → fireRevalidateWebhook('tag.updated', {id, slug})
//   - CMS op completes even if the webhook throws (fire-and-forget, D-07)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TagsService } from './tags.service';
import { TagEntity } from '../posts/infrastructure/entities/post-tag.entity';
import { TranslationsService } from '@src/modules/translations/translations.service';
import { WebhookDispatchService } from '@ext/web/webhook-dispatch.service';

describe('TagsService — revalidate webhook dispatch (R-CMS-A-04)', () => {
  let service: TagsService;
  let dispatch: { fireRevalidateWebhook: jest.Mock };
  let tagRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
  };

  const TAG_ID = 'tag-1';
  const TAG_SLUG = 'vuejs';

  beforeEach(async () => {
    dispatch = { fireRevalidateWebhook: jest.fn().mockResolvedValue(undefined) };

    tagRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (t: any) => ({ id: TAG_ID, slug: TAG_SLUG, name: 'Vue', ...t })),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: getRepositoryToken(TagEntity), useValue: tagRepository },
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

    service = module.get<TagsService>(TagsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('update', () => {
    it('should fire tag.updated webhook with id + slug after update', async () => {
      tagRepository.findOne.mockResolvedValue({ id: TAG_ID, slug: TAG_SLUG, name: 'Old' });
      await service.update(TAG_ID, { name: 'Vue.js' } as any);

      expect(dispatch.fireRevalidateWebhook).toHaveBeenCalledTimes(1);
      const [event, payload] = dispatch.fireRevalidateWebhook.mock.calls[0];
      expect(event).toBe('tag.updated');
      expect(payload).toEqual(expect.objectContaining({ id: TAG_ID, slug: TAG_SLUG }));
    });

    it('should complete update even if the webhook rejects (fire-and-forget, D-07)', async () => {
      tagRepository.findOne.mockResolvedValue({ id: TAG_ID, slug: TAG_SLUG, name: 'Old' });
      dispatch.fireRevalidateWebhook.mockRejectedValue(new Error('Astro down'));

      await expect(service.update(TAG_ID, { name: 'X' } as any)).resolves.toBeDefined();
      expect(dispatch.fireRevalidateWebhook).toHaveBeenCalledTimes(1);
    });
  });
});