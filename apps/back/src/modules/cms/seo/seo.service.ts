import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeoMetadataEntity } from './infrastructure/entities/seo-metadata.entity';
import { UpdateSeoDto } from './dto/update-seo.dto';

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

    return this.seoRepository.save(seo);
  }

  async delete(pageId: string, lang: string): Promise<void> {
    const seo = await this.findByPageId(pageId, lang);
    if (seo) {
      await this.seoRepository.remove(seo);
    }
  }
}
