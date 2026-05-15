import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { In } from 'typeorm';
import { BlogPostEntity } from './infrastructure/entities/blog-post.entity';
import { TagEntity } from './infrastructure/entities/post-tag.entity';
import { CreateBlogPostDto } from './dto/create-post.dto';
import { UpdateBlogPostDto } from './dto/update-post.dto';
import { FindAllBlogPostDto } from './dto/find-all-post.dto';
import { FilesService } from '@storage/files/files.service';
import { FileUploadDto } from '@storage/files/dto/file-upload.dto';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '@src/config/config.type';
import { TranslationEntity } from '@src/modules/translations/infrastructure/entities/translation.entity';

@Injectable()
export class BlogPostsService {
  private readonly logger = new Logger(BlogPostsService.name);

  constructor(
    @InjectRepository(BlogPostEntity)
    private readonly blogPostRepository: Repository<BlogPostEntity>,
    @InjectRepository(TagEntity)
    private readonly tagRepository: Repository<TagEntity>,
    @InjectRepository(TranslationEntity)
    private readonly translationRepository: Repository<TranslationEntity>,
    private readonly filesService: FilesService,
    @Inject('FILE_UPLOADER_SERVICE')
    private readonly fileUploaderService: any,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  private async loadTranslationsForPosts(
    posts: BlogPostEntity[],
  ): Promise<Map<string, Record<string, Record<string, string>>>> {
    if (posts.length === 0) {
      return new Map();
    }

    const postIds = posts.map((p) => p.id);
    const translations = await this.translationRepository.find({
      where: {
        entityName: 'BlogPost',
        entityId: In(postIds),
      },
      relations: ['lang'],
    });

    const result = new Map<string, Record<string, Record<string, string>>>();
    for (const post of posts) {
      result.set(post.id, {});
    }

    for (const t of translations) {
      const langCode = t.lang?.code || 'es';
      const postTranslations = result.get(t.entityId!) || {};
      if (!postTranslations[langCode]) {
        postTranslations[langCode] = {};
      }
      postTranslations[langCode][t.key] = t.content;
      result.set(t.entityId!, postTranslations);
    }

    return result;
  }

  private attachTranslations(
    post: BlogPostEntity,
    translationsMap: Map<string, Record<string, Record<string, string>>>,
  ): BlogPostEntity {
    const translations = translationsMap.get(post.id) || {};
    (post as any).translations = translations;
    return post;
  }

  async create(createPostDto: CreateBlogPostDto): Promise<BlogPostEntity> {
    const { categoryId, tagIds, author, ...postData } = createPostDto;

    // Normalize slug: strip leading /
    let slug = postData.slug;
    if (slug && slug.startsWith('/')) {
      slug = slug.slice(1);
      postData.slug = slug;
    }

    // Enforce slug uniqueness
    if (slug) {
      const existing = await this.blogPostRepository.findOne({
        where: { slug },
      });
      if (existing) {
        throw new ConflictException(
          `Blog post with slug "${slug}" already exists`,
        );
      }
    }

    // Create post without relations first
    const post = this.blogPostRepository.create(postData);

    // Handle category
    if (categoryId) {
      post.categoryId = categoryId;
    }

    // Handle tags (upsert via tagIds)
    if (tagIds && tagIds.length > 0) {
      const tags = await this.tagRepository.findBy({ id: In(tagIds) });
      post.tags = tags;
    }

    const saved = (await this.blogPostRepository.save(post)) as BlogPostEntity;
    (saved as any).translations = {};
    return saved;
  }

  async findAll(query: FindAllBlogPostDto & { categoryId?: string }) {
    const { page = 1, limit = 10, published, categoryId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (published !== undefined) {
      where.isPublished = published;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [data, total] = await this.blogPostRepository.findAndCount({
      where,
      order: { publishedAt: 'DESC', createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['featuredImage', 'author', 'category', 'tags'],
    });

    const translationsMap = await this.loadTranslationsForPosts(data);
    const dataWithTranslations = data.map((post) =>
      this.attachTranslations(post, translationsMap),
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

  async   findAllPublished(
    lang: string,
    page = 1,
    limit = 10,
    search?: string,
    tags?: string[],
    categoryId?: string,
  ) {
    const skip = (page - 1) * limit;

    const qb = this.blogPostRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.featuredImage', 'featuredImage')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.category', 'category')
      .leftJoinAndSelect('post.tags', 'tags')
      .where('post.isPublished = :isPublished', { isPublished: true });

    if (search) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM translation t
          WHERE t."entityId" = post.id
          AND t."entityName" = 'BlogPost'
          AND t.key = 'title'
          AND t.content ILIKE :search
        )`,
        { search: `%${search}%` },
      );
    }

    if (tags && tags.length > 0) {
      qb.innerJoin('post.tags', 'tagFilter', 'tagFilter.slug IN (:...tags)', {
        tags,
      });
    }

    if (categoryId) {
      qb.andWhere('post.categoryId = :categoryId', { categoryId });
    }

    qb.orderBy('post.publishedAt', 'DESC')
      .addOrderBy('post.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    const translationsMap = await this.loadTranslationsForPosts(data);
    const dataWithTranslations = data.map((post) =>
      this.attachTranslations(post, translationsMap),
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

  async findById(id: string): Promise<BlogPostEntity> {
    const post = await this.blogPostRepository.findOne({
      where: { id },
      relations: ['featuredImage', 'author', 'category', 'tags'],
    });
    if (!post) {
      throw new NotFoundException(`Blog post with ID ${id} not found`);
    }
    // Load translations for the post
    const translationsMap = await this.loadTranslationsForPosts([post]);
    this.attachTranslations(post, translationsMap);

    return post;
  }

  async findRelated(slug: string, limit = 3): Promise<BlogPostEntity[]> {
    const decodedSlug = decodeURIComponent(slug);
    const post = await this.blogPostRepository.findOne({
      where: { slug: decodedSlug },
      select: ['id', 'categoryId'],
    });

    if (!post) return [];

    const qb = this.blogPostRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.featuredImage', 'featuredImage')
      .leftJoinAndSelect('post.tags', 'tags')
      .where('post.isPublished = :isPublished', { isPublished: true })
      .andWhere('post.slug != :slug', { slug: decodedSlug })
      .andWhere('post.categoryId = :categoryId', { categoryId: post.categoryId })
      .orderBy('post.publishedAt', 'DESC')
      .take(limit);

    const data = await qb.getMany();
    const translationsMap = await this.loadTranslationsForPosts(data);
    return data.map((p) => this.attachTranslations(p, translationsMap));
  }

  async findBySlug(slug: string): Promise<BlogPostEntity> {
    const post = await this.blogPostRepository.findOne({
      where: { slug },
      relations: ['featuredImage', 'author', 'category', 'tags'],
    });
    if (!post) {
      throw new NotFoundException(`Blog post with slug ${slug} not found`);
    }

    const translationsMap = await this.loadTranslationsForPosts([post]);
    return this.attachTranslations(post, translationsMap);
  }

  async findBySlugPublic(slug: string): Promise<BlogPostEntity> {
    // First try to find by translated slug
    const translation = await this.translationRepository.findOne({
      where: {
        key: 'slug',
        section: 'blog-post',
        entityName: 'BlogPost',
        content: slug,
      },
      relations: ['lang'],
    });

    let post: BlogPostEntity | null = null;

    if (translation?.entityId) {
      post = await this.blogPostRepository.findOne({
        where: { id: translation.entityId, isPublished: true },
        relations: ['featuredImage', 'author', 'category', 'tags'],
      });
    }

    // Fallback to base slug
    if (!post) {
      post = await this.blogPostRepository.findOne({
        where: { slug, isPublished: true },
        relations: ['featuredImage', 'author', 'category', 'tags'],
      });
    }

    if (!post) {
      throw new NotFoundException(
        `Published blog post with slug ${slug} not found`,
      );
    }

    const translationsMap = await this.loadTranslationsForPosts([post]);
    return this.attachTranslations(post, translationsMap);
  }

  /**
   * Find posts by category - public endpoint
   */
  async findByCategory(categoryId: string, page = 1, limit = 10) {
    return this.findAll({ page, limit, published: true, categoryId });
  }

  async update(
    id: string,
    updatePostDto: UpdateBlogPostDto,
  ): Promise<BlogPostEntity> {
    const { categoryId, tagIds, ...postData } = updatePostDto;
    const post = await this.findById(id);

    // Update basic fields
    Object.assign(post, postData);

    // Handle category
    if (categoryId !== undefined) {
      post.categoryId = categoryId;
    }

    // Handle tags (upsert via tagIds)
    if (tagIds !== undefined) {
      if (tagIds.length > 0) {
        const tags = await this.tagRepository.findBy({ id: In(tagIds) });
        post.tags = tags;
      } else {
        post.tags = [];
      }
    }

    return this.blogPostRepository.save(post);
  }

  async publish(id: string, isPublished: boolean): Promise<BlogPostEntity> {
    const post = await this.findById(id);
    post.isPublished = isPublished;
    post.publishedAt = isPublished ? new Date() : null;
    return this.blogPostRepository.save(post);
  }

  async uploadFeaturedImage(
    postId: string,
    file: Express.Multer.File,
  ): Promise<{ url: string; fileId: string }> {
    const post = await this.findById(postId);

    const uploadBody: FileUploadDto = {
      entityName: 'BlogPost',
      entityId: postId,
      context: 'featured',
      isPublic: true,
    };

    const result = await this.fileUploaderService.create(file, uploadBody);

    // Associate uploaded file with the blog post
    post.featuredImageId = result.file.id;
    await this.blogPostRepository.save(post);

    const cdnBaseUrl = this.configService.get('app.cdnBaseUrl', {
      infer: true,
    });
    const url = cdnBaseUrl
      ? `${cdnBaseUrl}/${result.file.path}`
      : result.file.path;

    return { url, fileId: result.file.id };
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
