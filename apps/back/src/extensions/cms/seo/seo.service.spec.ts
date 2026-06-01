import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import { SeoService } from './seo.service';
import { SeoMetadataEntity } from './infrastructure/entities/seo-metadata.entity';
import { TranslationsService } from '@src/modules/translations/translations.service';

describe('SeoService.generateJsonLd', () => {
  let service: SeoService;
  let seoRepository: Repository<SeoMetadataEntity>;

  const mockSeoRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockTranslationsService = {
    getTranslationsForEntity: jest.fn().mockResolvedValue({}),
    getTranslationsForCategory: jest.fn().mockResolvedValue({}),
  };

  const mockDataSource = {
    query: jest.fn().mockResolvedValue([]),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('https://example.com'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeoService,
        {
          provide: getRepositoryToken(SeoMetadataEntity),
          useValue: mockSeoRepository,
        },
        {
          provide: TranslationsService,
          useValue: mockTranslationsService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SeoService>(SeoService);
    seoRepository = module.get<Repository<SeoMetadataEntity>>(
      getRepositoryToken(SeoMetadataEntity),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateJsonLd', () => {
    it('should generate WebPage schema', async () => {
      const page = { slug: 'about' };
      const seo = {
        metaTitle: 'About Us',
        metaDescription: 'We are great',
        ogImage: null,
      } as SeoMetadataEntity;
      const result = await service.generateJsonLd(page, seo, 'WebPage');

      expect(result['@type']).toBe('WebPage');
      expect(result.name).toBe('About Us');
      expect(result.description).toBe('We are great');
    });

    it('should generate Article schema for blog', async () => {
      const post = {
        slug: 'my-post',
        publishedAt: new Date('2024-01-01'),
      };
      const seo = {
        metaTitle: 'My Post',
        metaDescription: 'Post description',
        ogImage: null,
      } as SeoMetadataEntity;
      const result = await service.generateJsonLd(
        post,
        seo,
        'Article',
        'John Doe',
      );

      expect(result['@type']).toBe('Article');
      expect(result.headline).toBe('My Post');
      expect(result.author).toEqual({ '@type': 'Person', name: 'John Doe' });
    });

    it('should generate WebSite schema', async () => {
      const seo = { metaTitle: 'My Site' } as SeoMetadataEntity;
      const result = await service.generateJsonLd(
        { slug: '' } as { slug: string },
        seo,
        'WebSite',
      );

      expect(result['@type']).toBe('WebSite');
    });

    it('should handle ogImage in Article schema', async () => {
      const post = {
        slug: 'post-with-image',
        publishedAt: new Date('2024-01-01'),
      };
      const seo = {
        metaTitle: 'Post Title',
        metaDescription: 'Post desc',
        ogImage: { path: 'uploads/images/hero.jpg' },
      } as unknown as SeoMetadataEntity;
      const result = await service.generateJsonLd(post, seo, 'Article');

      expect(result['@type']).toBe('Article');
      expect(result.image).toBe('https://example.com/uploads/images/hero.jpg');
    });
  });
});
