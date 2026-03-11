import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogCategoryEntity } from './infrastructure/entities/blog-category.entity';
import { CreateBlogCategoryDto } from './dto/create-category.dto';

@Injectable()
export class BlogCategoriesService {
  constructor(
    @InjectRepository(BlogCategoryEntity)
    private readonly categoryRepository: Repository<BlogCategoryEntity>,
  ) {}

  async create(
    createCategoryDto: CreateBlogCategoryDto,
  ): Promise<BlogCategoryEntity> {
    const category = this.categoryRepository.create(createCategoryDto);
    return this.categoryRepository.save(category);
  }

  async findAll(): Promise<BlogCategoryEntity[]> {
    return this.categoryRepository.find({
      order: { order: 'ASC', createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<BlogCategoryEntity> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async findBySlug(slug: string): Promise<BlogCategoryEntity> {
    const category = await this.categoryRepository.findOne({ where: { slug } });
    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }
    return category;
  }

  async update(
    id: string,
    data: Partial<BlogCategoryEntity>,
  ): Promise<BlogCategoryEntity> {
    const category = await this.findById(id);
    Object.assign(category, data);
    return this.categoryRepository.save(category);
  }

  async reorder(orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.categoryRepository.update(orderedIds[i], { order: i });
    }
  }

  async remove(id: string): Promise<void> {
    const category = await this.findById(id);
    await this.categoryRepository.remove(category);
  }
}
