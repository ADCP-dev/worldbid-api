import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PageEntity } from './infrastructure/entities/page.entity';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { FindAllPageDto } from './dto/find-all-page.dto';

@Injectable()
export class PagesService {
  constructor(
    @InjectRepository(PageEntity)
    private readonly pageRepository: Repository<PageEntity>,
  ) {}

  async create(createPageDto: CreatePageDto): Promise<PageEntity> {
    const page = this.pageRepository.create(createPageDto);
    return this.pageRepository.save(page);
  }

  async findAll(query: FindAllPageDto) {
    const { page = 1, limit = 10, published } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (published !== undefined) {
      where.isPublished = published;
    }

    const [data, total] = await this.pageRepository.findAndCount({
      where,
      order: { order: 'ASC', createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['featuredImage', 'author'],
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

  async remove(id: string): Promise<void> {
    const page = await this.findById(id);
    await this.pageRepository.remove(page);
  }
}
