import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentPipelineIdeaEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/idea.entity';
import { ContentPipelineProjectEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/project.entity';
import { CreateIdeaDto } from '@ext/content-pipeline/dto/create-idea.dto';
import { UpdateIdeaDto } from '@ext/content-pipeline/dto/update-idea.dto';
import { FindAllIdeaDto } from '@ext/content-pipeline/dto/find-all-idea.dto';

@Injectable()
export class IdeaService {
  private readonly logger = new Logger(IdeaService.name);

  constructor(
    @InjectRepository(ContentPipelineIdeaEntity)
    private readonly repo: Repository<ContentPipelineIdeaEntity>,
    @InjectRepository(ContentPipelineProjectEntity)
    private readonly projectRepo: Repository<ContentPipelineProjectEntity>,
  ) {}

  /**
   * Paginated ideas for a project, with optional status filter and
   * title search. Ordered by `order` ASC (kanban) then createdAt DESC.
   */
  async findAllByProject(
    projectId: string,
    params: FindAllIdeaDto = {},
  ): Promise<{
    data: ContentPipelineIdeaEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 50, status, search } = params;

    const qb = this.repo
      .createQueryBuilder('idea')
      .where('idea.projectId = :projectId', { projectId });

    if (status) {
      qb.andWhere('idea.status = :status', { status });
    }

    if (search) {
      qb.andWhere('idea.title ILIKE :search', { search: `%${search}%` });
    }

    qb.orderBy('idea.order', 'ASC').addOrderBy('idea.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    this.logger.debug(
      `findAllByProject(project=${projectId}): ${data.length} of ${total} ideas`,
    );

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<ContentPipelineIdeaEntity> {
    const idea = await this.repo.findOne({ where: { id } });
    if (!idea) {
      throw new NotFoundException(`Idea ${id} not found`);
    }
    return idea;
  }

  async create(
    projectId: string,
    dto: CreateIdeaDto,
  ): Promise<ContentPipelineIdeaEntity> {
    // Validate project exists + is active/paused (not archived)
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    if (project.status === 'archived') {
      throw new BadRequestException(
        `Project ${projectId} is archived — cannot add ideas`,
      );
    }

    const status = dto.status ?? 'idea';
    const maxOrder = await this.repo
      .createQueryBuilder('i')
      .select('MAX(i.order)', 'max')
      .where('i.projectId = :projectId', { projectId })
      .andWhere('i.status = :status', { status })
      .getRawOne();

    const entity = this.repo.create({
      ...dto,
      projectId,
      order: Number(maxOrder?.max ?? 0) + 1,
      status,
      contentType: dto.contentType ?? 'recipe',
      source: dto.source ?? 'manual',
      priority: dto.priority ?? 3,
    });
    const saved = await this.repo.save(entity);
    this.logger.log(
      `Created idea id=${saved.id} for project=${projectId} (status=${status})`,
    );
    return saved;
  }

  async update(
    id: string,
    dto: UpdateIdeaDto,
  ): Promise<ContentPipelineIdeaEntity> {
    const idea = await this.findById(id);
    Object.assign(idea, dto);
    const saved = await this.repo.save(idea);
    this.logger.log(`Updated idea id=${id}`);
    return saved;
  }

  /**
   * Move an idea to a new kanban column. When the column changes and no
   * explicit `newOrder` is given, the idea is appended to the end of the
   * target column.
   */
  async updateStatus(
    id: string,
    status: string,
    newOrder?: number,
  ): Promise<ContentPipelineIdeaEntity> {
    const idea = await this.findById(id);
    const oldStatus = idea.status;
    idea.status = status;

    if (newOrder !== undefined) {
      idea.order = newOrder;
    } else if (oldStatus !== status) {
      const maxOrder = await this.repo
        .createQueryBuilder('i')
        .select('MAX(i.order)', 'max')
        .where('i.projectId = :projectId', { projectId: idea.projectId })
        .andWhere('i.status = :status', { status })
        .getRawOne();
      idea.order = Number(maxOrder?.max ?? 0) + 1;
    }

    const saved = await this.repo.save(idea);
    this.logger.log(
      `Idea id=${id} status: ${oldStatus} → ${status}` +
        (newOrder !== undefined ? ` (order=${newOrder})` : ''),
    );
    return saved;
  }

  async remove(id: string): Promise<void> {
    const idea = await this.findById(id);
    await this.repo.softRemove(idea);
    this.logger.log(`Soft-deleted idea id=${id}`);
  }

  /**
   * Reorder ideas (within a column or across columns). Receives an
   * ordered array of IDs; the new `order` field is `index + 1`.
   */
  async reorder(orderedIds: string[]): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await manager.update(
          this.repo.target,
          { id: orderedIds[i] },
          { order: i + 1 },
        );
      }
    });
    this.logger.debug(`Reordered ${orderedIds.length} ideas`);
  }

  /**
   * Approved ideas ready for draft generation, ranked by priority then order.
   */
  async findApprovedByProject(
    projectId: string,
    limit = 10,
  ): Promise<ContentPipelineIdeaEntity[]> {
    return this.repo.find({
      where: { projectId, status: 'approved' },
      order: { priority: 'DESC', order: 'ASC' },
      take: limit,
    });
  }
}
