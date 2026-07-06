import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type DeepPartial } from 'typeorm';
import { UpPostContentIdeaEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post-content-idea.entity';
import {
  CreateContentIdeaDto,
  UpdateContentIdeaDto,
} from '@ext/upload-post/dto/content-idea.dto';

@Injectable()
export class ContentIdeasService {
  private readonly logger = new Logger(ContentIdeasService.name);

  constructor(
    @InjectRepository(UpPostContentIdeaEntity)
    private readonly ideaRepo: Repository<UpPostContentIdeaEntity>,
  ) {}

  async findAll(): Promise<UpPostContentIdeaEntity[]> {
    return this.ideaRepo.find({ order: { order: 'ASC', createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<UpPostContentIdeaEntity | null> {
    return this.ideaRepo.findOne({ where: { id } });
  }

  async create(dto: CreateContentIdeaDto): Promise<UpPostContentIdeaEntity> {
    const maxOrder = await this.ideaRepo
      .createQueryBuilder('i')
      .select('MAX(i.order)', 'max')
      .where('i.status = :status', { status: dto.status ?? 'idea' })
      .getRawOne();

    const status = dto.status ?? 'idea';
    const entity = this.ideaRepo.create({
      ...dto,
      order: dto.order ?? Number(maxOrder?.max ?? 0) + 1,
      status: status as UpPostContentIdeaEntity['status'],
    } as DeepPartial<UpPostContentIdeaEntity>);
    return this.ideaRepo.save(entity);
  }

  async update(
    id: string,
    dto: UpdateContentIdeaDto,
  ): Promise<UpPostContentIdeaEntity> {
    const entity = await this.ideaRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`Content idea ${id} not found`);

    Object.assign(entity, dto);
    return this.ideaRepo.save(entity);
  }

  async updateStatus(
    id: string,
    status: UpPostContentIdeaEntity['status'],
    newOrder?: number,
  ) {
    const entity = await this.ideaRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`Content idea ${id} not found`);

    const oldStatus = entity.status;
    entity.status = status;

    if (newOrder !== undefined) {
      entity.order = newOrder;
    } else if (oldStatus !== status) {
      // Moved to a new column → put at end
      const maxOrder = await this.ideaRepo
        .createQueryBuilder('i')
        .select('MAX(i.order)', 'max')
        .where('i.status = :status', { status })
        .getRawOne();
      entity.order = Number(maxOrder?.max ?? 0) + 1;
    }

    if (status === 'published' && !entity.publishedAt) {
      entity.publishedAt = new Date();
    }

    return this.ideaRepo.save(entity);
  }

  async delete(id: string): Promise<void> {
    await this.ideaRepo.delete({ id });
  }

  /**
   * Reorder ideas within a status column.
   * Receives an ordered array of IDs and updates their order field.
   */
  async reorder(orderedIds: string[]): Promise<void> {
    await this.ideaRepo.manager.transaction(async (manager) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await manager.update(
          this.ideaRepo.target,
          { id: orderedIds[i] },
          { order: i + 1 },
        );
      }
    });
  }
}
