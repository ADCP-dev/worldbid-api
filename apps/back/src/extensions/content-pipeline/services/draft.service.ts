import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContentPipelineDraftEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/draft.entity';
import { UpdateDraftDto } from '@ext/content-pipeline/dto/update-draft.dto';
import { ProjectService } from '@ext/content-pipeline/services/project.service';
import { PublishingService, PublishResult } from '@ext/content-pipeline/services/publishing.service';
import { VideoGeneratorService } from '@ext/content-pipeline/services/video-generator.service';
import type { VideoSlide } from '@ext/content-pipeline/services/video-generator.service';
import { HtmlRendererService } from '@ext/content-pipeline/services/html-renderer.service';
import {
  CarouselGeneratorService,
} from '@ext/content-pipeline/services/carousel-generator.service';
import type {
  CarouselSlide,
  GenerateCarouselParams,
} from '@ext/content-pipeline/services/carousel-generator.service';
import type { GenerateCarouselVideoDto } from '@ext/content-pipeline/dto/generate-carousel-video.dto';

export interface DraftListResult {
  data: ContentPipelineDraftEntity[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class DraftService {
  private readonly logger = new Logger(DraftService.name);

  constructor(
    @InjectRepository(ContentPipelineDraftEntity)
    private readonly repo: Repository<ContentPipelineDraftEntity>,
    private readonly projectService: ProjectService,
    private readonly publishingService: PublishingService,
    private readonly videoGeneratorService: VideoGeneratorService,
    private readonly htmlRendererService: HtmlRendererService,
    private readonly carouselGeneratorService: CarouselGeneratorService,
  ) {}

  /**
   * Create a new draft. Called after content generation has assembled
   * blogContent, seoMetadata, socialVariants, images, affiliateLinks.
   */
  async create(
    data: Partial<ContentPipelineDraftEntity>,
  ): Promise<ContentPipelineDraftEntity> {
    const entity = this.repo.create({
      status: 'draft',
      ...data,
    });
    const saved = await this.repo.save(entity);
    this.logger.log(`Created draft id=${saved.id} projectId=${saved.projectId}`);
    return saved;
  }

  /**
   * Paginated list of drafts for a project.
   */
  async findAllByProject(
    projectId: string,
    page = 1,
    limit = 20,
    status?: string,
  ): Promise<DraftListResult> {
    const qb = this.repo.createQueryBuilder('draft');
    qb.andWhere('draft.projectId = :projectId', { projectId });
    if (status) qb.andWhere('draft.status = :status', { status });
    qb.orderBy('draft.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findById(id: string): Promise<ContentPipelineDraftEntity> {
    const draft = await this.repo.findOne({ where: { id } });
    if (!draft) throw new NotFoundException(`Draft ${id} not found`);
    return draft;
  }

  async update(
    id: string,
    dto: UpdateDraftDto,
  ): Promise<ContentPipelineDraftEntity> {
    const draft = await this.findById(id);
    Object.assign(draft, dto);
    return this.repo.save(draft);
  }

  /** Mark draft approved and ready for publishing. */
  async approve(id: string): Promise<ContentPipelineDraftEntity> {
    const draft = await this.findById(id);
    draft.status = 'approved';
    draft.reviewNotes = null;
    const saved = await this.repo.save(draft);
    this.logger.log(`Approved draft id=${id}`);
    return saved;
  }

  /** Mark draft rejected with optional reviewer notes. */
  async reject(id: string, reason?: string): Promise<ContentPipelineDraftEntity> {
    const draft = await this.findById(id);
    draft.status = 'rejected';
    draft.reviewNotes = reason ?? null;
    const saved = await this.repo.save(draft);
    this.logger.log(`Rejected draft id=${id}: ${reason ?? 'no reason'}`);
    return saved;
  }

  /**
   * Publish an approved draft to CMS + social via PublishingService.
   * Requires the draft to be in 'approved' status.
   */
  async publish(id: string): Promise<{ draft: ContentPipelineDraftEntity; result: PublishResult }> {
    const draft = await this.findById(id);
    if (draft.status !== 'approved') {
      throw new NotFoundException(
        `Draft ${id} must be approved before publishing (current: ${draft.status})`,
      );
    }

    const project = await this.projectService.findById(draft.projectId);
    draft.status = 'publishing';
    await this.repo.save(draft);

    try {
      const result = await this.publishingService.publish(draft, project);
      draft.publishedTo = {
        blogPostId: result.blogPostId,
        blogPostUrl: result.blogPostUrl,
        socialPosts: result.socialPosts,
      };
      draft.status = 'published';
      draft.publishedAt = new Date();
      const saved = await this.repo.save(draft);
      this.logger.log(`Published draft id=${id}`);
      return { draft: saved, result };
    } catch (err) {
      draft.status = 'approved'; // rollback to approved so it can be retried
      await this.repo.save(draft);
      this.logger.error(`Publish failed for draft ${id}: ${(err as Error)?.message ?? err}`);
      throw err;
    }
  }

  async findApprovedByProject(
    projectId: string,
    limit = 10,
  ): Promise<ContentPipelineDraftEntity[]> {
    return this.repo.find({
      where: { projectId, status: 'approved' },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async remove(id: string): Promise<void> {
    const draft = await this.findById(id);
    await this.repo.softRemove(draft);
    this.logger.log(`Soft-deleted draft id=${id}`);
  }

  /**
   * Generate a 9:16 (1080x1920) MP4 video from the draft's images
   * and first socialVariant caption. Stores the result in draft.videos.
   */
  async generateVideo(id: string): Promise<ContentPipelineDraftEntity> {
    const draft = await this.findById(id);

    if (!draft.images || draft.images.length === 0) {
      throw new NotFoundException(
        `Draft ${id} has no images — generate images first`,
      );
    }

    const caption = this.extractCaption(draft.socialVariants);
    const slides: VideoSlide[] = [];
    for (const img of draft.images) {
      const url = img['url'];
      const type = img['type'];
      if (typeof url !== 'string') continue;
      if (typeof type !== 'string') continue;
      if (type !== 'hero' && type !== 'content') continue;
      slides.push({ imageUrl: url, text: caption });
    }

    if (slides.length === 0) {
      throw new NotFoundException(
        `Draft ${id} has no hero/content images suitable for video`,
      );
    }

    this.logger.log(`Generating video for draft ${id}: ${slides.length} slides`);
    const result = await this.videoGeneratorService.generateVideo({ slides });

    const videos = Array.isArray(draft.videos) ? [...draft.videos] : [];
    videos.push({
      path: result.videoPath,
      platform: 'shorts',
      format: 'mp4',
      width: 1080,
      height: 1920,
      durationSec: result.durationSec,
      sizeBytes: result.sizeBytes,
      createdAt: new Date().toISOString(),
    });
    draft.videos = videos;
    const saved = await this.repo.save(draft);
    this.logger.log(`Video saved to draft ${id}: ${result.videoPath}`);
    return saved;
  }

  /**
   * Orchestrate the full carousel → video pipeline:
   *   draft content → carousel HTML slides → PNG screenshots → MP4 with xfade hyperframes.
   *
   * Stores the carousel HTML paths + post text in draft.carousels, and the
   * generated video in draft.videos.
   */
  async generateCarouselVideo(
    id: string,
    options?: GenerateCarouselVideoDto,
  ): Promise<ContentPipelineDraftEntity> {
    const draft = await this.findById(id);
    const format = options?.format ?? 'vertical';
    const transitions = options?.transitions;

    // 1. Extract carousel slide content from the draft.
    const carouselContent = this.extractCarouselContent(draft);
    if (carouselContent.slides.length === 0) {
      throw new NotFoundException(
        `Draft ${id} has no carousel content — generate content first`,
      );
    }

    this.logger.log(
      `generateCarouselVideo draft=${id}: ${carouselContent.slides.length} slides, format=${format}`,
    );

    // 2. Generate branded HTML slides + LinkedIn post text.
    const carouselParams: GenerateCarouselParams = {
      title: carouselContent.title,
      slides: carouselContent.slides,
      format,
    };
    const carousel = await this.carouselGeneratorService.generateCarouselSlides(
      carouselParams,
    );

    // 3. Render HTML slides → PNG screenshots.
    const renderOutDir = await mkdtemp(join(tmpdir(), 'cp-carousel-png-'));
    const height = format === 'portrait' ? 1350 : 1920;
    const pngPaths = await this.htmlRendererService.renderToPng({
      htmlContents: carousel.htmlContents,
      width: 1080,
      height,
      outputDir: renderOutDir,
    });

    // 4. Build VideoSlide[] from PNGs + slide text overlays.
    const videoSlides: VideoSlide[] = pngPaths.map((p, i) => ({
      imageUrl: p,
      text: carouselContent.slides[i]?.title ?? carouselContent.slides[i]?.body ?? '',
    }));

    // 5. Generate MP4 with xfade hyperframe transitions.
    const videoResult = await this.videoGeneratorService.generateVideo({
      slides: videoSlides,
      transitions,
      outputDir: await mkdtemp(join(tmpdir(), 'cp-carousel-video-')),
    });

    // 6. Store carousel metadata in draft.carousels.
    const carousels = Array.isArray(draft.carousels) ? [...draft.carousels] : [];
    carousels.push({
      pngDir: renderOutDir,
      slidesCount: carousel.htmlContents.length,
      postText: carousel.postText,
      format,
      createdAt: new Date().toISOString(),
    });
    draft.carousels = carousels;

    // 7. Store video in draft.videos.
    const videos = Array.isArray(draft.videos) ? [...draft.videos] : [];
    videos.push({
      path: videoResult.videoPath,
      platform: format === 'portrait' ? 'linkedin' : 'shorts',
      format: 'mp4',
      width: 1080,
      height,
      durationSec: videoResult.durationSec,
      sizeBytes: videoResult.sizeBytes,
      source: 'carousel',
      createdAt: new Date().toISOString(),
    });
    draft.videos = videos;

    const saved = await this.repo.save(draft);
    this.logger.log(
      `Carousel video saved to draft ${id}: ${videoResult.videoPath} (${videoResult.durationSec}s)`,
    );
    return saved;
  }

  /**
   * Extract carousel slide content from the draft's blogContent or socialVariants.
   * Looks for a carousel-type socialVariant first, then falls back to deriving
   * slides from the blog content headings.
   */
  private extractCarouselContent(
    draft: ContentPipelineDraftEntity,
  ): { title: string; slides: CarouselSlide[] } {
    // Check for a carousel-type socialVariant with structured slides.
    const variants = Array.isArray(draft.socialVariants) ? draft.socialVariants : [];
    for (const v of variants) {
      const mediaType = v['mediaType'];
      if (mediaType !== 'carousel') continue;
      const slidesRaw = v['slides'];
      if (Array.isArray(slidesRaw) && slidesRaw.length > 0) {
        const slides = slidesRaw
          .map((s) => this.normalizeCarouselSlide(s))
          .filter((s): s is CarouselSlide => s !== null);
        if (slides.length > 0) {
          const title = typeof v['caption'] === 'string' ? v['caption'] : '';
          return { title, slides };
        }
      }
    }

    // Fallback: derive slides from blog content (H2 headings → steps).
    const blog = draft.blogContent ?? '';
    const title = this.extractBlogTitle(blog);
    const slides = this.slidesFromBlog(blog);
    return { title, slides };
  }

  private normalizeCarouselSlide(raw: unknown): CarouselSlide | null {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;
    const type = obj['type'];
    if (typeof type !== 'string') return null;
    return {
      type: type as CarouselSlide['type'],
      mono: typeof obj['mono'] === 'string' ? obj['mono'] : undefined,
      title: typeof obj['title'] === 'string' ? obj['title'] : undefined,
      body: typeof obj['body'] === 'string' ? obj['body'] : undefined,
      stepNumber: typeof obj['stepNumber'] === 'string' ? obj['stepNumber'] : undefined,
      metricValue: typeof obj['metricValue'] === 'string' ? obj['metricValue'] : undefined,
      metricLabel: typeof obj['metricLabel'] === 'string' ? obj['metricLabel'] : undefined,
      quote: typeof obj['quote'] === 'string' ? obj['quote'] : undefined,
      quoteAuthor: typeof obj['quoteAuthor'] === 'string' ? obj['quoteAuthor'] : undefined,
      ctaText: typeof obj['ctaText'] === 'string' ? obj['ctaText'] : undefined,
      ctaButton: typeof obj['ctaButton'] === 'string' ? obj['ctaButton'] : undefined,
    };
  }

  private extractBlogTitle(blog: string): string {
    const match = blog.match(/^#\s+(.+)$/m);
    return match?.[1]?.trim() ?? '';
  }

  /**
   * Derive carousel slides from a markdown blog post:
   * - First H1 → hook
   * - Each H2 → step slide
   * - Last → summary + CTA
   */
  private slidesFromBlog(blog: string): CarouselSlide[] {
    if (!blog) return [];
    const lines = blog.split('\n');
    const slides: CarouselSlide[] = [];

    const h1 = blog.match(/^#\s+(.+)$/m);
    if (h1?.[1]) {
      slides.push({
        type: 'hook',
        mono: 'INTRO',
        title: h1[1].trim(),
      });
    }

    const h2Matches = [...blog.matchAll(/^##\s+(.+)$/gm)];
    let stepNum = 0;
    for (const m of h2Matches) {
      stepNum++;
      const heading = m[1]?.trim() ?? '';
      // Find the paragraph after this heading
      const headingIdx = lines.findIndex(
        (l) => l.trim() === `## ${heading}`,
      );
      const after = lines.slice(headingIdx + 1).find(
        (l) => l.trim() && !l.startsWith('#'),
      );
      slides.push({
        type: 'step',
        mono: `STEP ${String(stepNum).padStart(2, '0')}`,
        stepNumber: String(stepNum).padStart(2, '0'),
        title: heading,
        body: after?.trim() ?? '',
      });
    }

    // Add CTA at the end
    slides.push({
      type: 'cta',
      mono: 'FOLLOW',
      ctaText: 'Want more content like this?',
      ctaButton: 'Follow for more',
    });

    return slides;
  }

  private extractCaption(socialVariants: Record<string, unknown>[]): string {
    const first = socialVariants?.[0];
    if (!first) return '';
    const caption = first['caption'];
    return typeof caption === 'string' ? caption : '';
  }
}