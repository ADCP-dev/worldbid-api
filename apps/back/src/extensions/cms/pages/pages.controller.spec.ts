import { Test, TestingModule } from '@nestjs/testing';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@src/modules/iam/roles/roles.guard';

describe('PagesController', () => {
  let controller: PagesController;
  let pagesService: PagesService;

  const mockPagesService = {
    getPreview: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PagesController],
      providers: [
        {
          provide: PagesService,
          useValue: mockPagesService,
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PagesController>(PagesController);
    pagesService = module.get<PagesService>(PagesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /cms/pages/:id/preview', () => {
    const mockPreviewResponse = {
      id: 'uuid-123',
      slug: 'about-us',
      title: 'Sobre Nosotros',
      content: '<p>Content in Spanish</p>',
      excerpt: 'Short excerpt',
      seo: {
        metaTitle: 'About Us SEO',
        metaDescription: 'SEO description',
        ogImage: 'http://localhost:3000/uploads/images/og.jpg',
        customJsonLd: { '@type': 'WebPage' },
      },
    };

    it('should return preview data for valid page id', async () => {
      mockPagesService.getPreview.mockResolvedValue(mockPreviewResponse);

      const result = await controller.preview('uuid-123', 'es');

      expect(result).toEqual(mockPreviewResponse);
      expect(pagesService.getPreview).toHaveBeenCalledWith('uuid-123', 'es');
    });

    it('should use default language es when lang not provided', async () => {
      mockPagesService.getPreview.mockResolvedValue(mockPreviewResponse);

      await controller.preview('uuid-123', undefined);

      expect(pagesService.getPreview).toHaveBeenCalledWith('uuid-123', 'es');
    });

    it('should propagate NotFoundException from service', async () => {
      mockPagesService.getPreview.mockRejectedValue(
        new NotFoundException('Page not found'),
      );

      await expect(controller.preview('non-existent', 'es')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('GET /cms/pages/:id', () => {
    it('should return page by id', async () => {
      const mockPage = { id: 'uuid-123', slug: 'test' };
      mockPagesService.findById.mockResolvedValue(mockPage);

      const result = await controller.findOne('uuid-123');

      expect(result).toEqual(mockPage);
      expect(pagesService.findById).toHaveBeenCalledWith('uuid-123');
    });
  });
});
