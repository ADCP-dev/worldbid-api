import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BlogCategoryEntity } from './infrastructure/entities/blog-category.entity';
import { TagEntity } from '../posts/infrastructure/entities/post-tag.entity';
import { CreateBlogCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { TranslationsService } from '@src/modules/translations/translations.service';
import { slugify } from '@infra/utils/slugify';

export interface CategoryTree {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  order: number;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  tags?: TagEntity[];
  children?: CategoryTree[];
}

@Injectable()
export class BlogCategoriesService {
  private readonly logger = new Logger(BlogCategoriesService.name);

  constructor(
    @InjectRepository(BlogCategoryEntity)
    private readonly categoryRepository: Repository<BlogCategoryEntity>,
    @InjectRepository(TagEntity)
    private readonly tagRepository: Repository<TagEntity>,
    private readonly translationsService: TranslationsService,
  ) {}

  async create(
    createCategoryDto: CreateBlogCategoryDto,
    lang = 'es',
  ): Promise<BlogCategoryEntity> {
    const { name, slug, description, tagIds, ...rest } = createCategoryDto;

    const finalSlug = slug ?? slugify(name);

    // Enforce slug uniqueness
    const existing = await this.categoryRepository.findOne({
      where: { slug: finalSlug },
    });
    if (existing) {
      throw new BadRequestException(
        `Category with slug "${finalSlug}" already exists`,
      );
    }

    const category = this.categoryRepository.create({
      ...rest,
      name,
      slug: finalSlug,
    });

    const saved = await this.categoryRepository.save(category);

    // Persist name as translation
    if (name) {
      await this.translationsService.createTranslation({
        langCode: lang,
        key: 'name',
        content: name,
        entityName: 'Category',
        entityId: saved.id,
        section: 'content',
      });
    }

    // Persist description as translation
    if (description) {
      await this.translationsService.createTranslation({
        langCode: lang,
        key: 'description',
        content: description,
        entityName: 'Category',
        entityId: saved.id,
        section: 'content',
      });
    }

    // Associate tags
    if (tagIds && tagIds.length > 0) {
      const tags = await this.tagRepository.findBy({ id: In(tagIds) });
      saved.tags = tags;
      await this.categoryRepository.save(saved);
    }

    return saved;
  }

  async findAll(lang = 'es'): Promise<CategoryTree[]> {
    const categories = await this.categoryRepository.find({
      order: { order: 'ASC', createdAt: 'DESC' },
      relations: ['tags'],
    });

    // Hydrate name and description from translations
    const translations = await this.getTranslationsForCategories(
      categories.map((c) => c.id),
      lang,
    );

    // Build hierarchical structure
    const categoryMap = new Map<string, CategoryTree>();
    const roots: CategoryTree[] = [];

    // First pass: create map with just plain object
    for (const cat of categories) {
      const catTranslations = translations[cat.id] ?? {};
      categoryMap.set(cat.id, {
        id: cat.id,
        slug: cat.slug,
        name: catTranslations.name ?? cat.name,
        description: catTranslations.description ?? null,
        order: cat.order,
        parentId: cat.parentId,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        deletedAt: cat.deletedAt,
        tags: cat.tags,
        children: [],
      });
    }

    // Second pass: build tree
    for (const cat of categories) {
      const categoryNode = categoryMap.get(cat.id)!;
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        const parent = categoryMap.get(cat.parentId)!;
        parent.children = parent.children || [];
        parent.children.push(categoryNode);
      } else {
        roots.push(categoryNode);
      }
    }

    return roots;
  }

  async findById(
    id: string,
    lang = 'es',
  ): Promise<BlogCategoryEntity & { description?: string | null }> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['tags'],
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    const catTranslations = await this.getTranslationsForCategory(id, lang);
    return Object.assign(category, {
      name: catTranslations.name ?? category.name,
      description: catTranslations.description ?? null,
    });
  }

  async findBySlug(
    slug: string,
    lang = 'es',
  ): Promise<BlogCategoryEntity & { description?: string | null }> {
    const category = await this.categoryRepository.findOne({
      where: { slug },
      relations: ['tags'],
    });
    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }

    const catTranslations = await this.getTranslationsForCategory(
      category.id,
      lang,
    );
    return Object.assign(category, {
      name: catTranslations.name ?? category.name,
      description: catTranslations.description ?? null,
    });
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    lang = 'es',
  ): Promise<BlogCategoryEntity> {
    const { description, name, tagIds, ...rest } = updateCategoryDto;
    const category = await this.findById(id);

    // Validate circular reference if parentId is being updated
    if (rest.parentId !== undefined) {
      const newParentId = rest.parentId;

      // Cannot set parent to self
      if (newParentId === id) {
        throw new BadRequestException(
          'Circular reference detected: category cannot be its own parent',
        );
      }

      // Cannot set parent to a child
      if (newParentId) {
        const isDescendant = await this.isDescendant(id, newParentId);
        if (isDescendant) {
          throw new BadRequestException(
            'Circular reference detected: selected parent is a descendant of this category',
          );
        }
      }
    }

    Object.assign(category, rest);
    const saved = await this.categoryRepository.save(category);

    // Persist name as translation
    if (name !== undefined) {
      await this.translationsService.createTranslation({
        langCode: lang,
        key: 'name',
        content: name,
        entityName: 'Category',
        entityId: saved.id,
        section: 'content',
      });
    }

    // Persist description as translation
    if (description !== undefined) {
      await this.translationsService.createTranslation({
        langCode: lang,
        key: 'description',
        content: description,
        entityName: 'Category',
        entityId: saved.id,
        section: 'content',
      });
    }

    // Update tags
    if (tagIds !== undefined) {
      if (tagIds.length > 0) {
        const tags = await this.tagRepository.findBy({ id: In(tagIds) });
        saved.tags = tags;
      } else {
        saved.tags = [];
      }
      await this.categoryRepository.save(saved);
    }

    return saved;
  }

  /**
   * Check if potentialDescendantId is a descendant of ancestorId
   */
  private async isDescendant(
    ancestorId: string,
    potentialDescendantId: string,
  ): Promise<boolean> {
    const children = await this.categoryRepository.find({
      where: { parentId: ancestorId },
    });

    for (const child of children) {
      if (child.id === potentialDescendantId) {
        return true;
      }
      // Recursively check
      if (await this.isDescendant(child.id, potentialDescendantId)) {
        return true;
      }
    }

    return false;
  }

  async reorder(orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.categoryRepository.update(orderedIds[i], { order: i });
    }
  }

  async remove(id: string): Promise<void> {
    const category = await this.findById(id);

    // Check for children
    const children = await this.categoryRepository.find({
      where: { parentId: id },
    });
    if (children.length > 0) {
      throw new BadRequestException(
        'Cannot delete category: it has child categories. Please delete or reassign children first.',
      );
    }

    // TODO: Check for linked posts (BlogPostCategoryEntity) when that relation exists
    // For now, we only block if there are children

    await this.categoryRepository.remove(category);
  }

  private async getTranslationsForCategory(
    id: string,
    lang: string,
  ): Promise<{ name: string | null; description: string | null }> {
    const translations =
      await this.translationsService.getTranslationsForEntity(
        'Category',
        id,
        lang,
      );
    return {
      name: translations['name']?.value ?? null,
      description: translations['description']?.value ?? null,
    };
  }

  private async getTranslationsForCategories(
    ids: string[],
    lang: string,
  ): Promise<Record<string, { name: string | null; description: string | null }>> {
    const result: Record<string, { name: string | null; description: string | null }> = {};
    for (const id of ids) {
      result[id] = await this.getTranslationsForCategory(id, lang);
    }
    return result;
  }
}
