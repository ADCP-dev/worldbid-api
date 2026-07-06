import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmProjectEntity } from '../infrastructure/persistence/entities/crm-project.entity';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

@Injectable()
export class CrmProjectService {
  private readonly logger = new Logger(CrmProjectService.name);

  constructor(
    @InjectRepository(CrmProjectEntity)
    private readonly repository: Repository<CrmProjectEntity>,
  ) {}

  async findByClient(clientId: number): Promise<CrmProjectEntity[]> {
    return this.repository.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(params: { clientId?: number } = {}): Promise<CrmProjectEntity[]> {
    const where: { clientId?: number } = {};
    if (params.clientId) {
      where.clientId = params.clientId;
    }
    return this.repository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<CrmProjectEntity> {
    const project = await this.repository.findOne({
      where: { id },
      relations: ['client'],
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }
    return project;
  }

  async create(dto: CreateProjectDto): Promise<CrmProjectEntity> {
    const project = this.repository.create(dto);
    const saved = await this.repository.save(project);
    this.logger.log(`Created project id=${saved.id} for client=${dto.clientId}`);
    return saved;
  }

  async update(id: number, dto: UpdateProjectDto): Promise<CrmProjectEntity> {
    const project = await this.findOne(id);
    Object.assign(project, dto);
    const saved = await this.repository.save(project);
    this.logger.log(`Updated project id=${id}`);
    return saved;
  }

  async softDelete(id: number): Promise<void> {
    await this.findOne(id);
    await this.repository.softDelete(id);
    this.logger.log(`Soft-deleted project id=${id}`);
  }
}