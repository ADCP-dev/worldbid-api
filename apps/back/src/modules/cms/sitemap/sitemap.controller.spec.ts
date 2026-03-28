import { Test, TestingModule } from '@nestjs/testing';
import { SitemapController } from './sitemap.controller';
import { SitemapService, SitemapUrl } from './sitemap.service';

describe('SitemapController', () => {
  let controller: SitemapController;
  let sitemapService: SitemapService;

  const mockSitemapService = {
    getBlogUrls: jest.fn(),
    getPageUrls: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SitemapController],
      providers: [
        {
          provide: SitemapService,
          useValue: mockSitemapService,
        },
      ],
    }).compile();

    controller = module.get<SitemapController>(SitemapController);
    sitemapService = module.get<SitemapService>(SitemapService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /sitemap/pages', () => {
    const mockPageUrls: SitemapUrl[] = [
      {
        loc: 'https://example.com/es/about',
        lastmod: '2024-01-20T00:00:00.000Z',
        changefreq: 'monthly',
        priority: 0.6,
      },
      {
        loc: 'https://example.com/en/about',
        lastmod: '2024-01-20T00:00:00.000Z',
        changefreq: 'monthly',
        priority: 0.6,
      },
    ];

    it('should return array of page URLs', async () => {
      mockSitemapService.getPageUrls.mockResolvedValue(mockPageUrls);

      const result = await controller.getPageUrls();

      expect(result).toEqual(mockPageUrls);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should call sitemapService.getPageUrls', async () => {
      mockSitemapService.getPageUrls.mockResolvedValue([]);

      await controller.getPageUrls();

      expect(sitemapService.getPageUrls).toHaveBeenCalled();
    });

    it('should return page urls with correct structure', async () => {
      mockSitemapService.getPageUrls.mockResolvedValue(mockPageUrls);

      const result = await controller.getPageUrls();

      expect(result[0]).toHaveProperty('loc');
      expect(result[0]).toHaveProperty('lastmod');
      expect(result[0]).toHaveProperty('priority');
      expect(result[0]).toHaveProperty('changefreq');
    });
  });

  describe('GET /sitemap/blog', () => {
    const mockBlogUrls: SitemapUrl[] = [
      {
        loc: 'https://example.com/es/blog/first-post',
        lastmod: '2024-01-15T00:00:00.000Z',
        changefreq: 'weekly',
        priority: 0.8,
        alternates: {
          languages: {
            es: 'https://example.com/es/blog/first-post',
            en: 'https://example.com/en/blog/first-post',
          },
        },
      },
    ];

    it('should return array of blog URLs', async () => {
      mockSitemapService.getBlogUrls.mockResolvedValue(mockBlogUrls);

      const result = await controller.getBlogUrls();

      expect(result).toEqual(mockBlogUrls);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should call sitemapService.getBlogUrls', async () => {
      mockSitemapService.getBlogUrls.mockResolvedValue([]);

      await controller.getBlogUrls();

      expect(sitemapService.getBlogUrls).toHaveBeenCalled();
    });

    it('should return blog urls with alternates for languages', async () => {
      mockSitemapService.getBlogUrls.mockResolvedValue(mockBlogUrls);

      const result = await controller.getBlogUrls();

      expect(result[0]).toHaveProperty('alternates');
      expect(result[0].alternates?.languages).toHaveProperty('es');
      expect(result[0].alternates?.languages).toHaveProperty('en');
    });
  });
});
