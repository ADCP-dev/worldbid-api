import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeoMetadataEntity } from './infrastructure/entities/seo-metadata.entity';
import { UpdateSeoDto } from './dto/update-seo.dto';
import {
  WebPageSchema,
  ArticleSchema,
  WebSiteSchema,
} from './infrastructure/schemas/json-ld.schema';

@Injectable()
export class SeoService {
  constructor(
    @InjectRepository(SeoMetadataEntity)
    private readonly seoRepository: Repository<SeoMetadataEntity>,
  ) {}

  async findByPageId(
    pageId: string,
    lang: string,
  ): Promise<SeoMetadataEntity | null> {
    return this.seoRepository.findOne({
      where: { pageId, lang },
      relations: ['ogImage'],
    });
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
      seo.customJsonLd = await this.generateJsonLd(
        { slug: pageId },
        seo,
        updateSeoDto.type,
      );
    }

    return this.seoRepository.save(seo);
  }

  async generateJsonLd(
    entity: { slug: string; publishedAt?: Date | null },
    seo: SeoMetadataEntity,
    type: 'WebPage' | 'Article' | 'WebSite',
    author?: string,
  ): Promise<Record<string, any>> {
    let schema: Record<string, any>;

    // Adapt ogImage to match schema expected type
    const seoForSchema = {
      metaTitle: seo.metaTitle,
      metaDescription: seo.metaDescription,
      ogImage: seo.ogImage
        ? { url: `${process.env.APP_URL}/${seo.ogImage.path}` }
        : null,
    };

    switch (type) {
      case 'Article':
        schema = ArticleSchema(entity, seoForSchema, author);
        break;
      case 'WebSite':
        schema = WebSiteSchema(seo.metaTitle || 'Website');
        break;
      case 'WebPage':
      default:
        schema = WebPageSchema(entity, seoForSchema);
    }

    return schema;
  }

  async delete(pageId: string, lang: string): Promise<void> {
    const seo = await this.findByPageId(pageId, lang);
    if (seo) {
      await this.seoRepository.remove(seo);
    }
  }
}
