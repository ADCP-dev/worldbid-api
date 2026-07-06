import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ContentPipelineDraftEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/draft.entity';
import { UpdateDraftDto } from '@ext/content-pipeline/dto/update-draft.dto';
import { ProjectService } from '@ext/content-pipeline/services/project.service';
import { PublishingService, PublishResult } from '@ext/content-pipeline/services/publishing.service';

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
}