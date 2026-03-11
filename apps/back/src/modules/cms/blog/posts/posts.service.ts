import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogPostEntity } from './infrastructure/entities/blog-post.entity';
import { CreateBlogPostDto } from './dto/create-post.dto';
import { UpdateBlogPostDto } from './dto/update-post.dto';
import { FindAllBlogPostDto } from './dto/find-all-post.dto';
import { FilesService } from '@storage/files/files.service';

@Injectable()
export class BlogPostsService {
  private readonly logger = new Logger(BlogPostsService.name);

  constructor(
    @InjectRepository(BlogPostEntity)
    private readonly blogPostRepository: Repository<BlogPostEntity>,
    private readonly filesService: FilesService,
  ) {}

  async create(createPostDto: CreateBlogPostDto): Promise<BlogPostEntity> {
    const post = this.blogPostRepository.create(createPostDto);
    return this.blogPostRepository.save(post);
  }

  async findAll(query: FindAllBlogPostDto) {
    const { page = 1, limit = 10, published } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (published !== undefined) {
      where.isPublished = published;
    }

    const [data, total] = await this.blogPostRepository.findAndCount({
      where,
      order: { publishedAt: 'DESC', createdAt: 'DESC' },
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

    const [data, total] = await this.blogPostRepository.findAndCount({
      where: { isPublished: true },
      order: { publishedAt: 'DESC', createdAt: 'DESC' },
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

  async findById(id: string): Promise<BlogPostEntity> {
    const post = await this.blogPostRepository.findOne({
      where: { id },
      relations: ['featuredImage', 'author'],
    });
    if (!post) {
      throw new NotFoundException(`Blog post with ID ${id} not found`);
    }
    return post;
  }

  async findBySlug(slug: string): Promise<BlogPostEntity> {
    const post = await this.blogPostRepository.findOne({
      where: { slug },
      relations: ['featuredImage', 'author'],
    });
    if (!post) {
      throw new NotFoundException(`Blog post with slug ${slug} not found`);
    }
    return post;
  }

  async findBySlugPublic(slug: string): Promise<BlogPostEntity> {
    const post = await this.blogPostRepository.findOne({
      where: { slug, isPublished: true },
      relations: ['featuredImage', 'author'],
    });
    if (!post) {
      throw new NotFoundException(
        `Published blog post with slug ${slug} not found`,
      );
    }
    return post;
  }

  async update(
    id: string,
    updatePostDto: UpdateBlogPostDto,
  ): Promise<BlogPostEntity> {
    const post = await this.findById(id);
    Object.assign(post, updatePostDto);
    return this.blogPostRepository.save(post);
  }

  async publish(id: string, isPublished: boolean): Promise<BlogPostEntity> {
    const post = await this.findById(id);
    post.isPublished = isPublished;
    post.publishedAt = isPublished ? new Date() : null;
    return this.blogPostRepository.save(post);
  }

  async remove(id: string): Promise<void> {
    const post = await this.findById(id);

    try {
      const files = await this.filesService.findWithFilters({
        entityName: 'BlogPost',
        entityId: id,
      });

      for (const file of files) {
        try {
          await this.filesService.delete(file.id);
          this.logger.log(`Deleted file ${file.id} for BlogPost ${id}`);
        } catch (error) {
          this.logger.error(`Failed to delete file ${file.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error(`Error finding files for BlogPost ${id}:`, error);
    }

    await this.blogPostRepository.remove(post);
  }
}
