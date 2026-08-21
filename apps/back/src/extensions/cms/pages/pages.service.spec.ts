import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { PagesService } from './pages.service';
import { PageEntity, PageSection } from './infrastructure/entities/page.entity';
import { TranslationEntity } from '@src/modules/translations/infrastructure/entities/translation.entity';
import { TranslationsService } from '@src/modules/translations/translations.service';
import { SeoService } from '../seo/seo.service';
import { FilesService } from '@storage/files/files.service';
import { WebhookDispatchService } from '@ext/web/webhook-dispatch.service';

describe('PagesService', () => {
  let service: PagesService;
  let pageRepository: Repository<PageEntity>;

  const mockPageRepository = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockTranslationsService = {
    getTranslationsForEntity: jest.fn().mockResolvedValue({}),
  };

  const mockSeoService = {
    findByPageId: jest.fn().mockResolvedValue(null),
  };

  const mockFilesService = {
    findWithFilters: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const mockTranslationRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
  };

  const mockWebhookDispatch = {
    fireRevalidateWebhook: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        {
          provide: getRepositoryToken(PageEntity),
          useValue: mockPageRepository,
        },
        {
          provide: getRepositoryToken(TranslationEntity),
          useValue: mockTranslationRepository,
        },
        {
          provide: TranslationsService,
          useValue: mockTranslationsService,
        },
        {
          provide: SeoService,
          useValue: mockSeoService,
        },
        {
          provide: FilesService,
          useValue: mockFilesService,
        },
        {
          provide: WebhookDispatchService,
          useValue: mockWebhookDispatch,
        },
      ],
    }).compile();

    service = module.get<PagesService>(PagesService);
    pageRepository = module.get<Repository<PageEntity>>(
      getRepositoryToken(PageEntity),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should auto-generate slug from name when slug is not provided', async () => {
      const dto = { name: 'About Us', section: PageSection.LANDING };
      const created = { id: 'uuid-1', slug: 'about-us', name: 'About Us' };
      mockPageRepository.create.mockReturnValue(created);
      mockPageRepository.save.mockResolvedValue(created);

      const result = await service.create(dto as any);

      expect(pageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'about-us' }),
      );
      expect(result.slug).toBe('about-us');
    });

    it('should use provided slug when available', async () => {
      const dto = { name: 'About Us', slug: 'custom-slug' };
      const created = { id: 'uuid-1', slug: 'custom-slug', name: 'About Us' };
      mockPageRepository.create.mockReturnValue(created);
      mockPageRepository.save.mockResolvedValue(created);

      const result = await service.create(dto as any);

      expect(pageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'custom-slug' }),
      );
      expect(result.slug).toBe('custom-slug');
    });

    it('should throw NotFoundException when neither slug nor name is provided', async () => {
      const dto = { section: PageSection.BLOG };

      await expect(service.create(dto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle section field on create', async () => {
      const dto = { name: 'Docs', section: PageSection.DOCUMENTATION };
      const created = { id: 'uuid-1', slug: 'docs', section: 'documentation' };
      mockPageRepository.create.mockReturnValue(created);
      mockPageRepository.save.mockResolvedValue(created);

      const result = await service.create(dto as any);

      expect(pageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'docs',
          section: PageSection.DOCUMENTATION,
        }),
      );
      expect(result.slug).toBe('docs');
    });
  });

  describe('findAll', () => {
    it('should return paginated pages with meta', async () => {
      const pages = [
        { id: 'p1', slug: 'home', order: 0 },
        { id: 'p2', slug: 'about', order: 1 },
      ];
      mockPageRepository.findAndCount.mockResolvedValue([pages, 2]);

      const result = await service.findAll({ page: 1, limit: 10 } as any);

      expect(pageRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
          order: { order: 'ASC', createdAt: 'DESC' },
        }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by isPublished when provided', async () => {
      const pages = [{ id: 'p1', slug: 'home', isPublished: true }];
      mockPageRepository.findAndCount.mockResolvedValue([pages, 1]);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        isPublished: true,
      } as any);

      expect(pageRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublished: true },
        }),
      );
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return a page by id', async () => {
      const page = { id: 'uuid-1', slug: 'home' };
      mockPageRepository.findOne.mockResolvedValue(page);

      const result = await service.findById('uuid-1');

      expect(pageRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'uuid-1' },
        }),
      );
      expect(result).toEqual(page);
    });

    it('should throw NotFoundException when page not found', async () => {
      mockPageRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a page and return saved result', async () => {
      const existing = { id: 'uuid-1', slug: 'old-slug' };
      const updated = { id: 'uuid-1', slug: 'new-slug' };
      mockPageRepository.findOne.mockResolvedValue(existing);
      mockPageRepository.save.mockResolvedValue(updated);

      const result = await service.update('uuid-1', {
        slug: 'new-slug',
      } as any);

      expect(pageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'new-slug' }),
      );
      expect(result.slug).toBe('new-slug');
    });
  });

  describe('publish', () => {
    it('should publish a page and set publishedAt', async () => {
      const page = { id: 'uuid-1', slug: 'home', isPublished: false };
      mockPageRepository.findOne.mockResolvedValue(page);
      mockPageRepository.save.mockResolvedValue({
        ...page,
        isPublished: true,
        publishedAt: expect.any(Date),
      });

      const result = await service.publish('uuid-1', true);

      expect(pageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isPublished: true,
          publishedAt: expect.any(Date),
        }),
      );
      expect(result.isPublished).toBe(true);
    });

    it('should unpublish a page and clear publishedAt', async () => {
      const page = {
        id: 'uuid-1',
        slug: 'home',
        isPublished: true,
        publishedAt: new Date(),
      };
      mockPageRepository.findOne.mockResolvedValue(page);
      mockPageRepository.save.mockResolvedValue({
        ...page,
        isPublished: false,
        publishedAt: null,
      });

      const result = await service.publish('uuid-1', false);

      expect(pageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isPublished: false, publishedAt: null }),
      );
      expect(result.isPublished).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove a page and associated files', async () => {
      const page = { id: 'uuid-1', slug: 'home' };
      mockPageRepository.findOne.mockResolvedValue(page);

      await service.remove('uuid-1');

      expect(pageRepository.remove).toHaveBeenCalledWith(page);
      expect(mockFilesService.findWithFilters).toHaveBeenCalledWith({
        entityName: 'Page',
        entityId: 'uuid-1',
      });
    });

    it('should throw NotFoundException when page not found', async () => {
      mockPageRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
