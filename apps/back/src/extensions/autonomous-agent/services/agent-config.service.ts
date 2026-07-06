import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AaConfigEntity } from '@ext/autonomous-agent/infrastructure/persistence/entities/aa-config.entity';
import { CreateConfigDto } from '@ext/autonomous-agent/dto/create-config.dto';
import { UpdateConfigDto } from '@ext/autonomous-agent/dto/update-config.dto';
import { FindAllConfigDto } from '@ext/autonomous-agent/dto/find-all-config.dto';
import { AutonomousAgentConfig } from '@ext/autonomous-agent/config/autonomous-agent-config.type';

@Injectable()
export class AgentConfigService {
  private readonly logger = new Logger(AgentConfigService.name);

  constructor(
    @InjectRepository(AaConfigEntity)
    private readonly repo: Repository<AaConfigEntity>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Paginated list with optional filters (projectId, status).
   * Returns `{ data, total, page, limit }`.
   */
  async findAll(params: FindAllConfigDto = {}): Promise<{
    data: AaConfigEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, projectId, status } = params;

    const qb = this.repo.createQueryBuilder('config');

    if (projectId) {
      qb.andWhere('config.projectId = :projectId', { projectId });
    }
    if (status) {
      qb.andWhere('config.status = :status', { status });
    }

    qb.orderBy('config.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    this.logger.debug(
      `findAll: ${data.length} of ${total} configs (page ${page}, limit ${limit})`,
    );
    return { data, total, page, limit };
  }

  async findById(id: string): Promise<AaConfigEntity> {
    const config = await this.repo.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Autonomous-agent config ${id} not found`);
    }
    return config;
  }

  async findByProjectId(projectId: string): Promise<AaConfigEntity | null> {
    return this.repo.findOne({ where: { projectId } });
  }

  /**
   * Active configs only — used by the cron / orchestrator flows.
   */
  async findActive(): Promise<AaConfigEntity[]> {
    return this.repo.find({
      where: { status: 'active' },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Create a per-project config. projectId is unique, so creating a
   * second config for the same project throws ConflictException.
   */
  async create(dto: CreateConfigDto): Promise<AaConfigEntity> {
    const existing = await this.repo.findOne({
      where: { projectId: dto.projectId },
    });
    if (existing) {
      throw new ConflictException(
        `Config for project "${dto.projectId}" already exists`,
      );
    }

    const defaults = this.configService.get<AutonomousAgentConfig>(
      'autonomous-agent',
      { infer: true },
    );

    const entity = this.repo.create({
      projectId: dto.projectId,
      researchCron:
        dto.researchCron ?? defaults?.defaultResearchCron ?? '0 9 * * *',
      generateCron:
        dto.generateCron ?? defaults?.defaultGenerateCron ?? '0 10 * * *',
      publishCron:
        dto.publishCron ?? defaults?.defaultPublishCron ?? '0 18 * * *',
      metricsCron:
        dto.metricsCron ?? defaults?.defaultMetricsCron ?? '0 9 * * 1',
      autoApproveIdeas: dto.autoApproveIdeas ?? false,
      autoApproveDrafts: dto.autoApproveDrafts ?? false,
      notifyEmail: dto.notifyEmail ?? true,
      notifyTelegram: dto.notifyTelegram ?? false,
      telegramChatId: dto.telegramChatId ?? null,
      status: dto.status ?? 'active',
    });
    const saved = await this.repo.save(entity);
    this.logger.log(
      `Created config id=${saved.id} projectId=${saved.projectId}`,
    );
    return saved;
  }

  async update(id: string, dto: UpdateConfigDto): Promise<AaConfigEntity> {
    const config = await this.findById(id);
    Object.assign(config, dto);
    const saved = await this.repo.save(config);
    this.logger.log(`Updated config id=${id}`);
    return saved;
  }

  async pause(id: string): Promise<AaConfigEntity> {
    const config = await this.findById(id);
    config.status = 'paused';
    const saved = await this.repo.save(config);
    this.logger.log(`Paused config id=${id}`);
    return saved;
  }

  async resume(id: string): Promise<AaConfigEntity> {
    const config = await this.findById(id);
    config.status = 'active';
    const saved = await this.repo.save(config);
    this.logger.log(`Resumed config id=${id}`);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const config = await this.findById(id);
    await this.repo.remove(config);
    this.logger.log(`Removed config id=${id}`);
  }
}
