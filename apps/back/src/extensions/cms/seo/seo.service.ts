import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import type { Repository, DataSource } from 'typeorm';
import { SeoMetadataEntity } from './infrastructure/entities/seo-metadata.entity';
import { UpdateSeoDto } from './dto/update-seo.dto';
import { schemaRegistry } from './infrastructure/schemas/json-ld.registry';
import type { SchemaType } from './infrastructure/schemas/types';
import { TranslationsService } from '@src/modules/translations/translations.service';

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);

  constructor(
    @InjectRepository(SeoMetadataEntity)
    private readonly seoRepository: Repository<SeoMetadataEntity>,
    private readonly translationsService: TranslationsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findByPageId(
    pageId: string,
    lang: string,
  ): Promise<SeoMetadataEntity | null> {
    const seo = await this.seoRepository.findOne({
      where: { pageId, lang },
      relations: ['ogImage'],
    });

    // Resolve metaTitle and metaDescription from translations
    const { metaTitle, metaDescription } =
      await this.resolveMetaFromTranslations(pageId, lang);

    if (seo) {
      if (metaTitle !== undefined) seo.metaTitle = metaTitle;
      if (metaDescription !== undefined) seo.metaDescription = metaDescription;
      return seo;
    }

    // If no SeoMetadataEntity exists but we have translations, return a virtual entity
    if (metaTitle !== undefined || metaDescription !== undefined) {
      return this.seoRepository.create({
        pageId,
        lang,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
      });
    }

    return null;
  }

  private async resolveMetaFromTranslations(
    pageId: string,
    lang: string,
  ): Promise<{ metaTitle?: string; metaDescription?: string }> {
    // Try BlogPost entity translations first
    const blogPostTranslations =
      await this.translationsService.getTranslationsForEntity(
        'BlogPost',
        pageId,
        lang,
      );

    if (
      blogPostTranslations['metaTitle'] ||
      blogPostTranslations['metaDescription']
    ) {
      return {
        metaTitle: blogPostTranslations['metaTitle']?.value,
        metaDescription: blogPostTranslations['metaDescription']?.value,
      };
    }

    // Try Page category translations
    const pageResult = await this.dataSource.query(
      `SELECT name FROM "page" WHERE id = $1 LIMIT 1`,
      [pageId],
    );

    if (pageResult.length > 0) {
      const category = `page.${pageResult[0].name}`;
      const pageTranslations =
        await this.translationsService.getTranslationsForCategory(
          category,
          lang,
        );

      if (
        pageTranslations['metaTitle'] ||
        pageTranslations['metaDescription']
      ) {
        return {
          metaTitle: pageTranslations['metaTitle']?.value,
          metaDescription: pageTranslations['metaDescription']?.value,
        };
      }
    }

    return {};
  }

  async upsert(
    pageId: string,
    lang: string,
    updateSeoDto: UpdateSeoDto,
  ): Promise<SeoMetadataEntity> {
    let seo = await this.findByPageId(pageId, lang);

    if (seo) {
      Object.assign(seo, updateSeoDto);
    } else {
      seo = this.seoRepository.create({
        pageId,
        lang,
        ...updateSeoDto,
      });
    }

    // Generate JSON-LD schema if type is provided
    if (updateSeoDto.type) {
      seo.customJsonLd = this.generateJsonLd(
        { slug: pageId },
        seo,
        updateSeoDto.type,
      );
    }

    return this.seoRepository.save(seo);
  }

  generateJsonLd(
    entity: { slug: string; publishedAt?: Date | null },
    seo: SeoMetadataEntity,
    type: 'WebPage' | 'Article' | 'WebSite',
    author?: string,
  ): Record<string, unknown> {
    // Build input for the schema factory
    const schemaInput = {
      slug: entity.slug,
      publishedAt: entity.publishedAt,
      metaTitle: seo.metaTitle || '',
      metaDescription: seo.metaDescription,
      ogImage: seo.ogImage
        ? {
            url: `${process.env.APP_URL || 'https://example.com'}/${seo.ogImage.path}`,
          }
        : null,
      author,
    };

    // Use registry to generate schema
    const schema = schemaRegistry.generate(type as SchemaType, schemaInput);
    return schema as Record<string, unknown>;
  }

  /**
   * Generate JSON-LD schema for a specific page
   */
  async generatePageSchema(
    pageId: string,
    lang: string,
  ): Promise<Record<string, unknown> | null> {
    const seo = await this.findByPageId(pageId, lang);
    if (!seo) {
      return null;
    }

    const schemaType = seo.type || 'WebPage';
    const schema = schemaRegistry.generate(schemaType as SchemaType, {
      slug: pageId,
      metaTitle: seo.metaTitle || '',
      metaDescription: seo.metaDescription,
      ogImage: seo.ogImage
        ? {
            url: `${process.env.APP_URL || 'https://example.com'}/${seo.ogImage.path}`,
          }
        : null,
    });

    return schema as Record<string, unknown>;
  }

  /**
   * Generate Organization schema from site configuration
   */
  generateOrganizationSchema(config: {
    name: string;
    url: string;
    logo?: string;
    sameAs?: string[];
  }): Record<string, unknown> {
    const schema = schemaRegistry.generate('Organization', config);
    return schema as Record<string, unknown>;
  }

  /**
   * Generate BreadcrumbList schema from path segments
   */
  generateBreadcrumbSchema(
    pathSegments: Array<{ name: string; url: string }>,
  ): Record<string, unknown> {
    const schema = schemaRegistry.generate('BreadcrumbList', { pathSegments });
    return schema as Record<string, unknown>;
  }

  async delete(pageId: string, lang: string): Promise<void> {
    const seo = await this.findByPageId(pageId, lang);
    if (seo) {
      await this.seoRepository.remove(seo);
    }
  }
}
