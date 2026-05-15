import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TagEntity } from '../posts/infrastructure/entities/post-tag.entity';
import { CreateTagDto } from '../posts/dto/create-tag.dto';
import { UpdateTagDto } from '../posts/dto/update-tag.dto';
import { FindAllTagDto } from '../posts/dto/find-all-tag.dto';
import { TranslationsService } from '@src/modules/translations/translations.service';
import { slugify } from '@infra/utils/slugify';

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(
    @InjectRepository(TagEntity)
    private readonly tagRepository: Repository<TagEntity>,
    private readonly translationsService: TranslationsService,
  ) {}

  async create(createTagDto: CreateTagDto, lang = 'es'): Promise<TagEntity> {
    const slug = createTagDto.slug ?? slugify(createTagDto.name);

    // Enforce slug uniqueness
    const existing = await this.tagRepository.findOne({
      where: { slug },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(`Tag with slug "${slug}" already exists`);
    }

    const tag = this.tagRepository.create({
      ...createTagDto,
      slug,
    });

    const saved = await this.tagRepository.save(tag);

    // Persist name as translation
    await this.translationsService.createTranslation({
      langCode: lang,
      key: 'name',
      content: createTagDto.name,
      entityName: 'Tag',
      entityId: saved.id,
      section: 'content',
    });

    return saved;
  }

  async findAll(query: FindAllTagDto): Promise<{
    data: TagEntity[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 10, lang } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.tagRepository.findAndCount({
      where: { deletedAt: IsNull() },
      order: { name: 'ASC' },
      skip,
      take: limit,
    });

    // Hydrate names from translations if lang is provided
    if (lang) {
      for (const tag of data) {
        const translations =
          await this.translationsService.getTranslationsForEntity(
            'Tag',
            tag.id,
            lang,
          );
        if (translations['name']?.value) {
          (tag as any).name = translations['name'].value;
        }
      }
    }

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAllPublic(lang: string = 'es'): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      postCount: number;
    }>
  > {
    const tags = await this.tagRepository
      .createQueryBuilder('tag')
      .leftJoin('tag.posts', 'post', 'post.isPublished = :isPublished', {
        isPublished: true,
      })
      .select([
        'tag.id as id',
        'tag.slug as slug',
        'tag.name as name',
        'COUNT(post.id)::int as "postCount"',
      ])
      .where('tag.deletedAt IS NULL')
      .groupBy('tag.id')
      .orderBy('tag.name', 'ASC')
      .getRawMany();

    // Hydrate names from translations
    for (const tag of tags) {
      const translations =
        await this.translationsService.getTranslationsForEntity(
          'Tag',
          tag.id,
          lang,
        );
      if (translations['name']?.value) {
        tag.name = translations['name'].value;
      }
    }

    return tags;
  }

  async findOne(id: string, lang?: string): Promise<TagEntity> {
    const tag = await this.tagRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }

    if (lang) {
      const translations =
        await this.translationsService.getTranslationsForEntity(
          'Tag',
          tag.id,
          lang,
        );
      if (translations['name']?.value) {
        (tag as any).name = translations['name'].value;
      }
    }

    return tag;
  }

  async update(
    id: string,
    updateTagDto: UpdateTagDto,
    lang = 'es',
  ): Promise<TagEntity> {
    const tag = await this.findOne(id);

    // If slug is being updated, enforce uniqueness
    if (updateTagDto.slug && updateTagDto.slug !== tag.slug) {
      const existing = await this.tagRepository.findOne({
        where: { slug: updateTagDto.slug },
        withDeleted: true,
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Tag with slug "${updateTagDto.slug}" already exists`,
        );
      }
    }

    Object.assign(tag, updateTagDto);
    const saved = await this.tagRepository.save(tag);

    // If name is updated, update translation
    if (updateTagDto.name) {
      await this.translationsService.createTranslation({
        langCode: lang,
        key: 'name',
        content: updateTagDto.name,
        entityName: 'Tag',
        entityId: saved.id,
        section: 'content',
      });
    }

    return saved;
  }

  async remove(id: string): Promise<void> {
    const tag = await this.findOne(id);
    await this.tagRepository.softDelete(tag.id);
  }
}
