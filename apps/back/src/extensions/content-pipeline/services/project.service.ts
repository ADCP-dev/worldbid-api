import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ContentPipelineProjectEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/project.entity';
import { CreateCpProjectDto } from '@ext/content-pipeline/dto/create-project.dto';
import { UpdateCpProjectDto } from '@ext/content-pipeline/dto/update-project.dto';
import { FindAllProjectDto } from '@ext/content-pipeline/dto/find-all-project.dto';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectRepository(ContentPipelineProjectEntity)
    private readonly repo: Repository<ContentPipelineProjectEntity>,
  ) {}

  /**
   * Paginated list with optional search (name | slug) and filters
   * (status, niche). Returns `{ data, total, page, limit }`.
   */
  async findAll(params: FindAllProjectDto = {}): Promise<{
    data: ContentPipelineProjectEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, search, status, niche } = params;

    const qb = this.repo.createQueryBuilder('project');

    if (search) {
      qb.andWhere([
        { name: ILike(`%${search}%`) },
        { slug: ILike(`%${search}%`) },
      ]);
    }

    if (status) {
      qb.andWhere('project.status = :status', { status });
    }

    if (niche) {
      qb.andWhere('project.niche = :niche', { niche });
    }

    qb.orderBy('project.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    this.logger.debug(
      `findAll: ${data.length} of ${total} projects (page ${page}, limit ${limit})`,
    );

    return { data, total, page, limit };
  }

  /**
   * Active projects only — used by cron/research flows.
   */
  async findActive(): Promise<ContentPipelineProjectEntity[]> {
    return this.repo.find({
      where: { status: 'active' },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<ContentPipelineProjectEntity> {
    const project = await this.repo.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async create(dto: CreateCpProjectDto): Promise<ContentPipelineProjectEntity> {
    const existing = await this.repo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Project slug "${dto.slug}" already exists`);
    }

    const entity = this.repo.create({
      ...dto,
      status: dto.status ?? 'active',
      language: dto.language ?? 'es',
      autoPublish: dto.autoPublish ?? { blog: false, social: false },
    });
    const saved = await this.repo.save(entity);
    this.logger.log(`Created project id=${saved.id} slug=${saved.slug}`);
    return saved;
  }

  async update(
    id: string,
    dto: UpdateCpProjectDto,
  ): Promise<ContentPipelineProjectEntity> {
    const project = await this.findById(id);
    Object.assign(project, dto);
    const saved = await this.repo.save(project);
    this.logger.log(`Updated project id=${id}`);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const project = await this.findById(id);
    await this.repo.softRemove(project);
    this.logger.log(`Soft-deleted project id=${id}`);
  }
}
