import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpPostContentIdeaEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post-content-idea.entity';

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

  async create(data: Partial<UpPostContentIdeaEntity>): Promise<UpPostContentIdeaEntity> {
    const maxOrder = await this.ideaRepo
      .createQueryBuilder('i')
      .select('MAX(i.order)', 'max')
      .where('i.status = :status', { status: data.status ?? 'idea' })
      .getRawOne();

    const entity = this.ideaRepo.create({
      ...data,
      order: data.order ?? (Number(maxOrder?.max ?? 0) + 1),
      status: data.status ?? 'idea',
    });
    return this.ideaRepo.save(entity);
  }

  async update(id: string, data: Partial<UpPostContentIdeaEntity>): Promise<UpPostContentIdeaEntity> {
    const entity = await this.ideaRepo.findOne({ where: { id } });
    if (!entity) throw new Error(`Content idea ${id} not found`);

    Object.assign(entity, data);
    return this.ideaRepo.save(entity);
  }

  async updateStatus(id: string, status: UpPostContentIdeaEntity['status'], newOrder?: number) {
    const entity = await this.ideaRepo.findOne({ where: { id } });
    if (!entity) throw new Error(`Content idea ${id} not found`);

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
    for (let i = 0; i < orderedIds.length; i++) {
      await this.ideaRepo.update({ id: orderedIds[i] }, { order: i + 1 });
    }
  }
}