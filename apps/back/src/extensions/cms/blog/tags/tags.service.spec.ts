import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagEntity } from '../posts/infrastructure/entities/post-tag.entity';
import { TranslationsService } from '@src/modules/translations/translations.service';

describe('TagsService', () => {
  let service: TagsService;
  let tagRepository: Repository<TagEntity>;

  const mockTagRepository = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockTranslationsService = {
    createTranslation: jest.fn().mockResolvedValue({}),
    getTranslationsForEntity: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
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

    service = module.get<TagsService>(TagsService);
    tagRepository = module.get<Repository<TagEntity>>(
      getRepositoryToken(TagEntity),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a tag with auto-generated slug', async () => {
      const dto = { name: 'Vue.js' };
      const created = { id: 'uuid-1', name: 'Vue.js', slug: 'vuejs' };
      mockTagRepository.findOne.mockResolvedValue(null);
      mockTagRepository.create.mockReturnValue(created);
      mockTagRepository.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(tagRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'vuejs', name: 'Vue.js' }),
      );
      expect(result.slug).toBe('vuejs');
    });

    it('should throw ConflictException when slug already exists', async () => {
      const dto = { name: 'Nuxt', slug: 'nuxt' };
      mockTagRepository.findOne.mockResolvedValue({
        id: 'existing',
        slug: 'nuxt',
      });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should throw ConflictException when updating to a duplicate slug', async () => {
      const existingTag = { id: 'tag-1', slug: 'old-slug', name: 'Old' };
      mockTagRepository.findOne
        .mockResolvedValueOnce(existingTag) // findOne in update
        .mockResolvedValueOnce({ id: 'tag-2', slug: 'new-slug' }); // duplicate check

      await expect(
        service.update('tag-1', { slug: 'new-slug' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should soft-delete an existing tag', async () => {
      const tag = { id: 'tag-1', slug: 'vuejs', name: 'Vue.js' };
      mockTagRepository.findOne.mockResolvedValue(tag);

      await service.remove('tag-1');

      expect(tagRepository.softDelete).toHaveBeenCalledWith('tag-1');
    });

    it('should throw NotFoundException when tag does not exist', async () => {
      mockTagRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
