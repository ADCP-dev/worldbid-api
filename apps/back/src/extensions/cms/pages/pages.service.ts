import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PageEntity } from './infrastructure/entities/page.entity';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { FindAllPageDto } from './dto/find-all-page.dto';
import { TranslationsService } from '@src/modules/translations/translations.service';
import { SeoService } from '../seo/seo.service';
import { FilesService } from '@storage/files/files.service';
import { slugify } from '@infra/utils/slugify';
import { TranslationEntity } from '@src/modules/translations/infrastructure/entities/translation.entity';

@Injectable()
export class PagesService {
  private readonly logger = new Logger(PagesService.name);

  constructor(
    @InjectRepository(PageEntity)
    private readonly pageRepository: Repository<PageEntity>,
    @InjectRepository(TranslationEntity)
    private readonly translationRepository: Repository<TranslationEntity>,
    private readonly translationsService: TranslationsService,
    private readonly seoService: SeoService,
    private readonly filesService: FilesService,
  ) {}

  async create(createPageDto: CreatePageDto): Promise<PageEntity> {
    const { name, slug, author, ...rest } = createPageDto;

    if (!name) {
      throw new NotFoundException('Name is required');
    }

    const finalSlug = slug ?? slugify(name);

    const page = this.pageRepository.create({
      ...rest,
      name,
      slug: finalSlug,
    });

    const saved = await this.pageRepository.save(page);
    (saved as any).translations = {};
    return saved;
  }

  private async loadTranslationsForPages(
    pages: PageEntity[],
  ): Promise<Map<string, Record<string, Record<string, string>>>> {
    if (pages.length === 0) {
      return new Map();
    }

    const categories = pages.map((p) => `page.${p.name}`);
    const translations = await this.translationRepository.find({
      where: {
        category: In(categories),
      },
      relations: ['lang'],
    });

    const result = new Map<string, Record<string, Record<string, string>>>();
    for (const page of pages) {
      result.set(page.id, {});
    }

    for (const t of translations) {
      const langCode = t.lang?.code || 'es';
      const matchingPage = pages.find((p) => `page.${p.name}` === t.category);
      if (!matchingPage) continue;

      const pageTranslations = result.get(matchingPage.id) || {};
      if (!pageTranslations[langCode]) {
        pageTranslations[langCode] = {};
      }
      pageTranslations[langCode][t.key] = t.content;
      result.set(matchingPage.id, pageTranslations);
    }

    return result;
  }

  private attachTranslations(
    page: PageEntity,
    translationsMap: Map<string, Record<string, Record<string, string>>>,
  ): PageEntity {
    const translations = translationsMap.get(page.id) || {};
    (page as any).translations = translations;
    return page;
  }

  async findAll(query: FindAllPageDto) {
    const { page = 1, limit = 10, isPublished } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    const [data, total] = await this.pageRepository.findAndCount({
      where,
      order: { order: 'ASC', createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['featuredImage', 'author'],
    });

    const translationsMap = await this.loadTranslationsForPages(data);
    const dataWithTranslations = data.map((p) =>
      this.attachTranslations(p, translationsMap),
    );

    return {
      data: dataWithTranslations,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAllPublished(lang: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await this.pageRepository.findAndCount({
      where: { isPublished: true },
      order: { order: 'ASC', createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['featuredImage'],
    });

    const translationsMap = await this.loadTranslationsForPages(data);
    const dataWithTranslations = data.map((p) =>
      this.attachTranslations(p, translationsMap),
    );

    return {
      data: dataWithTranslations,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<PageEntity> {
    const page = await this.pageRepository.findOne({
      where: { id },
      relations: ['featuredImage', 'author'],
    });
    if (!page) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }

    const translationsMap = await this.loadTranslationsForPages([page]);
    return this.attachTranslations(page, translationsMap);
  }

  async findBySlug(slug: string): Promise<PageEntity> {
    const page = await this.pageRepository.findOne({
      where: { slug },
      relations: ['featuredImage', 'author'],
    });
    if (!page) {
      throw new NotFoundException(`Page with slug ${slug} not found`);
    }

    const translationsMap = await this.loadTranslationsForPages([page]);
    return this.attachTranslations(page, translationsMap);
  }

  async findBySlugPublic(slug: string): Promise<PageEntity> {
    // First try to find by translated slug in any page category
    const translation = await this.translationRepository.findOne({
      where: {
        key: 'slug',
        section: 'page',
        content: slug,
      },
      relations: ['lang'],
    });

    let page: PageEntity | null = null;

    if (translation?.category) {
      const pageName = translation.category.replace(/^page\./, '');
      page = await this.pageRepository.findOne({
        where: { name: pageName, isPublished: true },
        relations: ['featuredImage'],
      });
    }

    // Fallback to base slug
    if (!page) {
      page = await this.pageRepository.findOne({
        where: { slug, isPublished: true },
        relations: ['featuredImage'],
      });
    }

    if (!page) {
      throw new NotFoundException(`Published page with slug ${slug} not found`);
    }

    const translationsMap = await this.loadTranslationsForPages([page]);
    return this.attachTranslations(page, translationsMap);
  }

  async update(id: string, updatePageDto: UpdatePageDto): Promise<PageEntity> {
    const page = await this.findById(id);
    Object.assign(page, updatePageDto);
    const saved = await this.pageRepository.save(page);

    // Reload translations if name changed
    const translationsMap = await this.loadTranslationsForPages([saved]);
    return this.attachTranslations(saved, translationsMap);
  }

  async publish(id: string, isPublished: boolean): Promise<PageEntity> {
    const page = await this.findById(id);
    page.isPublished = isPublished;
    page.publishedAt = isPublished ? new Date() : null;
    return this.pageRepository.save(page);
  }

  async reorder(orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.pageRepository.update(orderedIds[i], { order: i });
    }
  }

  async reorderPages(
    pageIds: string[],
    parentId: string | null,
  ): Promise<void> {
    await Promise.all(
      pageIds.map((id, index) =>
        this.pageRepository.update(id, {
          order: index,
          parentId: parentId,
        }),
      ),
    );
  }

  async getPreview(
    id: string,
    lang: string,
  ): Promise<{
    id: string;
    slug: string;
    title: string;
    content: string;
    excerpt: string;
    seo: {
      metaTitle: string;
      metaDescription: string;
      ogImage: string;
      customJsonLd: Record<string, any>;
    };
  }> {
    const page = await this.findById(id);
    const category = `page.${page.name}`;

    // Get translations for this page and lang
    const translations =
      await this.translationsService.getTranslationsForCategory(
        category,
        lang,
      );

    const seo = await this.seoService.findByPageId(id, lang);

    return {
      id: page.id,
      slug: page.slug,
      title: translations['title']?.value || '',
      content: translations['content']?.value || '',
      excerpt: translations['excerpt']?.value || '',
      seo: {
        metaTitle: seo?.metaTitle || '',
        metaDescription: seo?.metaDescription || '',
        ogImage: seo?.ogImage
          ? `${process.env.APP_URL}/${seo.ogImage.path}`
          : '',
        customJsonLd: seo?.customJsonLd || {},
      },
    };
  }

  async remove(id: string): Promise<void> {
    const page = await this.findById(id);

    // Cascade delete: remove associated files
    try {
      const files = await this.filesService.findWithFilters({
        entityName: 'Page',
        entityId: id,
      });

      for (const file of files) {
        try {
          await this.filesService.delete(file.id);
          this.logger.log(`Deleted file ${file.id} for Page ${id}`);
        } catch (error) {
          this.logger.error(`Failed to delete file ${file.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error(`Error finding files for Page ${id}:`, error);
    }

    await this.pageRepository.remove(page);
  }
}
