import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { ContentPipelineCtaVideoEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/cta-video.entity';
import type { CreateCtaVideoDto } from '@ext/content-pipeline/dto/create-cta-video.dto';
import type { UpdateCtaVideoDto } from '@ext/content-pipeline/dto/update-cta-video.dto';

/**
 * CRUD service for CTA video clips stored as URLs (S3 presigned or public CDN).
 *
 * Invariant: at most one row has `isActive = true` (the default CTA used by
 * templates). Setting `isActive = true` on a row deactivates all others inside
 * a single transaction.
 */
@Injectable()
export class CtaVideoService {
  private readonly logger = new Logger(CtaVideoService.name);

  constructor(
    @InjectRepository(ContentPipelineCtaVideoEntity)
    private readonly repo: Repository<ContentPipelineCtaVideoEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /** List all CTA videos (newest first), excluding soft-deleted. */
  async findAll(): Promise<ContentPipelineCtaVideoEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  /** Return the currently active CTA video, or null if none is active. */
  async findActive(): Promise<ContentPipelineCtaVideoEntity | null> {
    return this.repo.findOne({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
    });
  }

  /** Return the URL of the active CTA video, or empty string if none. */
  async findActiveUrl(): Promise<string> {
    const active = await this.findActive();
    return active?.url ?? '';
  }

  async findById(id: string): Promise<ContentPipelineCtaVideoEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`CTA video ${id} not found`);
    }
    return entity;
  }

  /**
   * Create a new CTA video. If `isActive` is true, all other rows are
   * deactivated within a transaction.
   */
  async create(dto: CreateCtaVideoDto): Promise<ContentPipelineCtaVideoEntity> {
    return this.dataSource.transaction(async (manager) => {
      if (dto.isActive) {
        await manager.update(
          ContentPipelineCtaVideoEntity,
          { isActive: true },
          { isActive: false },
        );
      }
      const entity = manager.create(ContentPipelineCtaVideoEntity, {
        name: dto.name,
        url: dto.url,
        format: dto.format ?? 'mp4',
        durationSec: dto.durationSec ?? null,
        isActive: dto.isActive ?? false,
        description: dto.description ?? null,
      });
      const saved = await manager.save(entity);
      this.logger.log(`Created CTA video "${saved.name}" (id=${saved.id}, active=${saved.isActive})`);
      return saved;
    });
  }

  /**
   * Update a CTA video. If `isActive` is being set to true, all other rows
   * are deactivated within a transaction.
   */
  async update(
    id: string,
    dto: UpdateCtaVideoDto,
  ): Promise<ContentPipelineCtaVideoEntity> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(ContentPipelineCtaVideoEntity, {
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException(`CTA video ${id} not found`);
      }
      if (dto.isActive === true) {
        // Deactivate all other active rows so only this one remains active.
        await manager
          .createQueryBuilder()
          .update(ContentPipelineCtaVideoEntity)
          .set({ isActive: false })
          .where('isActive = :active AND id != :id', { active: true, id })
          .execute();
      }
      manager.merge(ContentPipelineCtaVideoEntity, existing, dto);
      const saved = await manager.save(existing);
      this.logger.log(`Updated CTA video ${id} (active=${saved.isActive})`);
      return saved;
    });
  }

  /** Soft delete a CTA video by id. */
  async remove(id: string): Promise<void> {
    const entity = await this.findById(id);
    await this.repo.softRemove(entity);
    this.logger.log(`Soft-deleted CTA video ${id}`);
  }
}