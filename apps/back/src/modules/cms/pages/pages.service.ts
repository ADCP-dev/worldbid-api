import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PageEntity } from './infrastructure/entities/page.entity';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { FindAllPageDto } from './dto/find-all-page.dto';
import { TranslationsService } from '@src/modules/translations/translations.service';
import { SeoService } from '../seo/seo.service';
import { FilesService } from '@storage/files/files.service';

@Injectable()
export class PagesService {
  private readonly logger = new Logger(PagesService.name);

  constructor(
    @InjectRepository(PageEntity)
    private readonly pageRepository: Repository<PageEntity>,
    private readonly translationsService: TranslationsService,
    private readonly seoService: SeoService,
    private readonly filesService: FilesService,
  ) {}

  async create(createPageDto: CreatePageDto): Promise<PageEntity> {
    const page = this.pageRepository.create(createPageDto);
    return this.pageRepository.save(page);
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

    // Fetch translations for page titles (default lang: es)
    const pagesWithTitles = await Promise.all(
      data.map(async (pageEntity) => {
        const translations =
          await this.translationsService.getTranslationsForEntity(
            'Page',
            pageEntity.id,
            'es',
          );
        return {
          ...pageEntity,
          title: translations['title']?.value || pageEntity.slug,
        };
      }),
    );

    return {
      data: pagesWithTitles,
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

  async findById(id: string): Promise<PageEntity> {
    const page = await this.pageRepository.findOne({
      where: { id },
      relations: ['featuredImage', 'author'],
    });
    if (!page) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }
    return page;
  }

  async findBySlug(slug: string): Promise<PageEntity> {
    const page = await this.pageRepository.findOne({
      where: { slug },
      relations: ['featuredImage', 'author'],
    });
    if (!page) {
      throw new NotFoundException(`Page with slug ${slug} not found`);
    }
    return page;
  }

  async findBySlugPublic(slug: string): Promise<PageEntity> {
    const page = await this.pageRepository.findOne({
      where: { slug, isPublished: true },
      relations: ['featuredImage'],
    });
    if (!page) {
      throw new NotFoundException(`Published page with slug ${slug} not found`);
    }
    return page;
  }

  async update(id: string, updatePageDto: UpdatePageDto): Promise<PageEntity> {
    const page = await this.findById(id);
    Object.assign(page, updatePageDto);
    return this.pageRepository.save(page);
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

    // Get translations for this page and lang
    const translations =
      await this.translationsService.getTranslationsForEntity(
        'Page',
        page.id,
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
