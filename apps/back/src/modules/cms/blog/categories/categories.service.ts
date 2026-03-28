import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogCategoryEntity } from './infrastructure/entities/blog-category.entity';
import { CreateBlogCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

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
  children?: CategoryTree[];
}

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

  async findAll(): Promise<CategoryTree[]> {
    const categories = await this.categoryRepository.find({
      order: { order: 'ASC', createdAt: 'DESC' },
    });

    // Build hierarchical structure
    const categoryMap = new Map<string, CategoryTree>();
    const roots: CategoryTree[] = [];

    // First pass: create map with just plain object
    for (const cat of categories) {
      categoryMap.set(cat.id, {
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        order: cat.order,
        parentId: cat.parentId,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        deletedAt: cat.deletedAt,
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
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<BlogCategoryEntity> {
    const category = await this.findById(id);

    // Validate circular reference if parentId is being updated
    if (updateCategoryDto.parentId !== undefined) {
      const newParentId = updateCategoryDto.parentId;

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

    Object.assign(category, updateCategoryDto);
    return this.categoryRepository.save(category);
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
}
