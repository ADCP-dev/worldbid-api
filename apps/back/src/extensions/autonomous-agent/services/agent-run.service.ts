import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AaRunEntity } from '@ext/autonomous-agent/infrastructure/persistence/entities/aa-run.entity';
import { FindAllRunDto } from '@ext/autonomous-agent/dto/find-all-run.dto';

export type RunType = 'research' | 'generate' | 'publish' | 'metrics';
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

@Injectable()
export class AgentRunService {
  private readonly logger = new Logger(AgentRunService.name);

  constructor(
    @InjectRepository(AaRunEntity)
    private readonly repo: Repository<AaRunEntity>,
  ) {}

  /**
   * Paginated list with optional filters (projectId, runType, status).
   * Returns `{ data, total, page, limit }`.
   */
  async findAll(
    params: FindAllRunDto = {},
  ): Promise<{
    data: AaRunEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, projectId, runType, status } = params;

    const qb = this.repo.createQueryBuilder('run');

    if (projectId) {
      qb.andWhere('run.projectId = :projectId', { projectId });
    }
    if (runType) {
      qb.andWhere('run.runType = :runType', { runType });
    }
    if (status) {
      qb.andWhere('run.status = :status', { status });
    }

    qb.orderBy('run.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    this.logger.debug(
      `findAll: ${data.length} of ${total} runs (page ${page}, limit ${limit})`,
    );
    return { data, total, page, limit };
  }

  async findById(id: string): Promise<AaRunEntity> {
    const run = await this.repo.findOne({ where: { id } });
    if (!run) {
      throw new NotFoundException(`Run ${id} not found`);
    }
    return run;
  }

  async create(input: {
    configId: string;
    projectId: string;
    runType: RunType;
  }): Promise<AaRunEntity> {
    const entity = this.repo.create({
      configId: input.configId,
      projectId: input.projectId,
      runType: input.runType,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      duration: null,
      output: {},
      errorMessage: null,
    });
    const saved = await this.repo.save(entity);
    this.logger.log(
      `Created run id=${saved.id} type=${input.runType} projectId=${input.projectId}`,
    );
    return saved;
  }

  async updateStatus(
    id: string,
    status: RunStatus,
    patch?: {
      output?: Record<string, unknown>;
      errorMessage?: string | null;
    },
  ): Promise<AaRunEntity> {
    const run = await this.findById(id);

    run.status = status;
    if (status === 'running' && !run.startedAt) {
      run.startedAt = new Date();
    }
    if (status === 'completed' || status === 'failed') {
      run.completedAt = new Date();
      if (run.startedAt) {
        run.duration = run.completedAt.getTime() - run.startedAt.getTime();
      }
    }
    if (patch?.output !== undefined) {
      run.output = patch.output;
    }
    if (patch?.errorMessage !== undefined) {
      run.errorMessage = patch.errorMessage;
    }

    const saved = await this.repo.save(run);
    this.logger.log(
      `Run id=${id} status=${status}${
        status === 'completed' || status === 'failed'
          ? ` duration=${saved.duration}ms`
          : ''
      }`,
    );
    return saved;
  }

  /**
   * Recent runs for a project — used by the feedback loop and reports.
   * Returns newest first, limited to `take` (default 50).
   */
  async findRecentByProject(
    projectId: string,
    take = 50,
  ): Promise<AaRunEntity[]> {
    return this.repo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
      take,
    });
  }
}