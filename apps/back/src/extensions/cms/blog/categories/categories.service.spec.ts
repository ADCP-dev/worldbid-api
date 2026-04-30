import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BlogCategoriesService } from './categories.service';
import { BlogCategoryEntity } from './infrastructure/entities/blog-category.entity';
import { TagEntity } from '../posts/infrastructure/entities/post-tag.entity';
import { TranslationsService } from '@src/modules/translations/translations.service';

describe('BlogCategoriesService', () => {
  let service: BlogCategoriesService;
  let categoryRepository: Repository<BlogCategoryEntity>;

  const mockCategoryRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockTagRepository = {
    findBy: jest.fn(),
  };

  const mockTranslationsService = {
    createTranslation: jest.fn().mockResolvedValue({}),
    getTranslationsForEntity: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogCategoriesService,
        {
          provide: getRepositoryToken(BlogCategoryEntity),
          useValue: mockCategoryRepository,
        },
        {
          provide: getRepositoryToken(TagEntity),
          useValue: mockTagRepository,
        },
        {
          provide: TranslationsService,
          useValue: mockTranslationsService,
        },
      ],
    }).compile();

    service = module.get<BlogCategoriesService>(BlogCategoriesService);
    categoryRepository = module.get<Repository<BlogCategoryEntity>>(
      getRepositoryToken(BlogCategoryEntity),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a category and persist name and description as translations', async () => {
      const dto = {
        name: 'Technology',
        slug: 'tech',
        description: 'Tech posts',
      };
      const created = { id: 'uuid-1', name: 'Technology', slug: 'tech' };
      mockCategoryRepository.findOne.mockResolvedValue(null);
      mockCategoryRepository.create.mockReturnValue(created);
      mockCategoryRepository.save.mockResolvedValue(created);

      const result = await service.create(dto as any, 'es');

      expect(categoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'tech', name: 'Technology' }),
      );
      expect(mockTranslationsService.createTranslation).toHaveBeenCalledWith(
        expect.objectContaining({
          langCode: 'es',
          key: 'name',
          content: 'Technology',
          entityName: 'Category',
          entityId: 'uuid-1',
          section: 'content',
        }),
      );
      expect(mockTranslationsService.createTranslation).toHaveBeenCalledWith(
        expect.objectContaining({
          langCode: 'es',
          key: 'description',
          content: 'Tech posts',
          entityName: 'Category',
          entityId: 'uuid-1',
          section: 'content',
        }),
      );
      expect(result.id).toBe('uuid-1');
    });

    it('should auto-generate slug from name when slug is not provided', async () => {
      const dto = { name: 'Web Development', description: 'Web posts' };
      const created = {
        id: 'uuid-2',
        name: 'Web Development',
        slug: 'web-development',
      };
      mockCategoryRepository.findOne.mockResolvedValue(null);
      mockCategoryRepository.create.mockReturnValue(created);
      mockCategoryRepository.save.mockResolvedValue(created);

      const result = await service.create(dto as any, 'es');

      expect(categoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'web-development' }),
      );
      expect(result.slug).toBe('web-development');
    });

    it('should throw BadRequestException when slug already exists', async () => {
      const dto = { name: 'Duplicate', slug: 'dup' };
      mockCategoryRepository.findOne.mockResolvedValue({
        id: 'existing',
        slug: 'dup',
      });

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should associate tags when tagIds are provided', async () => {
      const dto = {
        name: 'Technology',
        slug: 'tech',
        tagIds: ['tag-1', 'tag-2'],
      };
      const created = { id: 'uuid-3', name: 'Technology', slug: 'tech' };
      const tags = [
        { id: 'tag-1', name: 'Tag 1' },
        { id: 'tag-2', name: 'Tag 2' },
      ];
      mockCategoryRepository.findOne.mockResolvedValue(null);
      mockCategoryRepository.create.mockReturnValue(created);
      mockCategoryRepository.save
        .mockResolvedValueOnce(created)
        .mockResolvedValueOnce({ ...created, tags });
      mockTagRepository.findBy.mockResolvedValue(tags);

      const result = await service.create(dto as any, 'es');

      expect(mockTagRepository.findBy).toHaveBeenCalledWith({
        id: expect.anything(),
      });
      expect(result.tags).toEqual(tags);
    });
  });

  describe('findAll', () => {
    it('should hydrate descriptions from translations and build tree', async () => {
      const categories = [
        {
          id: 'c1',
          slug: 'tech',
          name: 'Technology',
          order: 0,
          parentId: null,
          tags: [],
        },
        {
          id: 'c2',
          slug: 'web',
          name: 'Web',
          order: 1,
          parentId: 'c1',
          tags: [],
        },
      ];
      mockCategoryRepository.find.mockResolvedValue(categories);
      mockTranslationsService.getTranslationsForEntity
        .mockResolvedValueOnce({ description: { value: 'Tech desc' } })
        .mockResolvedValueOnce({ description: { value: 'Web desc' } });

      const result = await service.findAll('es');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
      expect(result[0].description).toBe('Tech desc');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].description).toBe('Web desc');
    });

    it('should return empty array when no categories exist', async () => {
      mockCategoryRepository.find.mockResolvedValue([]);

      const result = await service.findAll('es');

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return category with description from translations', async () => {
      const category = {
        id: 'c1',
        slug: 'tech',
        name: 'Technology',
        tags: [],
      };
      mockCategoryRepository.findOne.mockResolvedValue(category);
      mockTranslationsService.getTranslationsForEntity.mockResolvedValue({
        description: { value: 'Tech desc' },
      });

      const result = await service.findById('c1', 'es');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'c1',
          description: 'Tech desc',
        }),
      );
    });

    it('should throw NotFoundException when category not found', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should persist name and description as translations on update', async () => {
      const category = {
        id: 'c1',
        slug: 'tech',
        name: 'Technology',
        tags: [],
      };
      mockCategoryRepository.findOne.mockResolvedValue(category);
      mockCategoryRepository.save.mockResolvedValue({
        ...category,
        name: 'Updated Tech',
      });

      const result = await service.update(
        'c1',
        { name: 'Updated Tech', description: 'Updated desc' } as any,
        'es',
      );

      expect(mockTranslationsService.createTranslation).toHaveBeenCalledWith(
        expect.objectContaining({
          langCode: 'es',
          key: 'name',
          content: 'Updated Tech',
          entityName: 'Category',
          entityId: 'c1',
          section: 'content',
        }),
      );
      expect(mockTranslationsService.createTranslation).toHaveBeenCalledWith(
        expect.objectContaining({
          langCode: 'es',
          key: 'description',
          content: 'Updated desc',
          entityName: 'Category',
          entityId: 'c1',
          section: 'content',
        }),
      );
      expect(result.name).toBe('Updated Tech');
    });

    it('should replace tags when tagIds are provided', async () => {
      const category = {
        id: 'c1',
        slug: 'tech',
        name: 'Technology',
        tags: [{ id: 'old-tag', name: 'Old' }],
      };
      const newTags = [{ id: 'tag-1', name: 'Tag 1' }];
      mockCategoryRepository.findOne.mockResolvedValue(category);
      mockCategoryRepository.save.mockResolvedValue({
        ...category,
        tags: newTags,
      });
      mockTagRepository.findBy.mockResolvedValue(newTags);

      const result = await service.update(
        'c1',
        { tagIds: ['tag-1'] } as any,
        'es',
      );

      expect(mockTagRepository.findBy).toHaveBeenCalledWith({
        id: expect.anything(),
      });
      expect(result.tags).toEqual(newTags);
    });

    it('should clear tags when tagIds is empty', async () => {
      const category = {
        id: 'c1',
        slug: 'tech',
        name: 'Technology',
        tags: [{ id: 'old-tag', name: 'Old' }],
      };
      mockCategoryRepository.findOne.mockResolvedValue(category);
      mockCategoryRepository.save.mockResolvedValue({
        ...category,
        tags: [],
      });

      const result = await service.update('c1', { tagIds: [] } as any, 'es');

      expect(result.tags).toEqual([]);
    });

    it('should throw BadRequestException when setting self as parent', async () => {
      const category = {
        id: 'c1',
        slug: 'tech',
        name: 'Technology',
        parentId: null,
        tags: [],
      };
      mockCategoryRepository.findOne.mockResolvedValue(category);

      await expect(
        service.update('c1', { parentId: 'c1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when parent is a descendant', async () => {
      const category = {
        id: 'c1',
        slug: 'tech',
        name: 'Technology',
        tags: [],
      };
      const child = {
        id: 'c2',
        slug: 'web',
        name: 'Web',
        parentId: 'c1',
      };
      mockCategoryRepository.findOne.mockResolvedValue(category);
      mockCategoryRepository.find.mockResolvedValue([child]);

      await expect(
        service.update('c1', { parentId: 'c2' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a category without children', async () => {
      const category = {
        id: 'c1',
        slug: 'tech',
        name: 'Technology',
        tags: [],
      };
      mockCategoryRepository.findOne.mockResolvedValue(category);
      mockCategoryRepository.find.mockResolvedValue([]);

      await service.remove('c1');

      expect(categoryRepository.remove).toHaveBeenCalledWith(category);
    });

    it('should throw BadRequestException when category has children', async () => {
      const category = {
        id: 'c1',
        slug: 'tech',
        name: 'Technology',
        tags: [],
      };
      mockCategoryRepository.findOne.mockResolvedValue(category);
      mockCategoryRepository.find.mockResolvedValue([
        { id: 'c2', slug: 'web', name: 'Web' },
      ]);

      await expect(service.remove('c1')).rejects.toThrow(BadRequestException);
    });
  });
});
