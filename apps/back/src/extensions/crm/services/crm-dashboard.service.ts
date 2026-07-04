import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmClientEntity } from '../infrastructure/persistence/entities/crm-client.entity';
import { CrmProjectEntity } from '../infrastructure/persistence/entities/crm-project.entity';
import { CrmInteractionEntity } from '../infrastructure/persistence/entities/crm-interaction.entity';
import { CrmStatusEntity } from '../infrastructure/persistence/entities/crm-status.entity';
import { CrmOriginEntity } from '../infrastructure/persistence/entities/crm-origin.entity';

export interface CrmDashboardResult {
  totalClients: number;
  activeClients: number;
  clientsByStatus: { statusId: number; statusName: string; label: string; color: string; count: number }[];
  clientsByOrigin: { originId: number; originName: string; label: string; count: number }[];
  activeProjects: number;
  projectsByStatus: { status: string; count: number }[];
  recentInteractions: CrmInteractionEntity[];
}

@Injectable()
export class CrmDashboardService {
  private readonly logger = new Logger(CrmDashboardService.name);

  constructor(
    @InjectRepository(CrmClientEntity)
    private readonly clientRepository: Repository<CrmClientEntity>,
    @InjectRepository(CrmProjectEntity)
    private readonly projectRepository: Repository<CrmProjectEntity>,
    @InjectRepository(CrmInteractionEntity)
    private readonly interactionRepository: Repository<CrmInteractionEntity>,
    @InjectRepository(CrmStatusEntity)
    private readonly statusRepository: Repository<CrmStatusEntity>,
    @InjectRepository(CrmOriginEntity)
    private readonly originRepository: Repository<CrmOriginEntity>,
  ) {}

  async getDashboard(): Promise<CrmDashboardResult> {
    this.logger.debug('Building CRM dashboard aggregates');

    const totalClients = await this.clientRepository.count();
    const activeClients = await this.clientRepository.count({
      where: { isActive: true },
    });

    // Clients by status
    const statuses = await this.statusRepository.find();
    const statusCounts = await this.clientRepository
      .createQueryBuilder('client')
      .select('client.statusId', 'statusId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('client.statusId')
      .getRawMany<{ statusId: number; count: string }>();

    const statusMap = new Map<number, number>();
    for (const row of statusCounts) {
      statusMap.set(Number(row.statusId), Number(row.count));
    }

    const clientsByStatus = statuses.map((s) => ({
      statusId: s.id,
      statusName: s.name,
      label: s.label,
      color: s.color,
      count: statusMap.get(s.id) ?? 0,
    }));

    // Clients by origin
    const origins = await this.originRepository.find();
    const originCounts = await this.clientRepository
      .createQueryBuilder('client')
      .select('client.originId', 'originId')
      .addSelect('COUNT(*)', 'count')
      .where('client.originId IS NOT NULL')
      .groupBy('client.originId')
      .getRawMany<{ originId: number; count: string }>();

    const originMap = new Map<number, number>();
    for (const row of originCounts) {
      originMap.set(Number(row.originId), Number(row.count));
    }

    const clientsByOrigin = origins.map((o) => ({
      originId: o.id,
      originName: o.name,
      label: o.label,
      count: originMap.get(o.id) ?? 0,
    }));

    // Active projects
    const activeProjects = await this.projectRepository.count({
      where: { status: 'in_progress' },
    });

    // Projects by status
    const projectStatusRows = await this.projectRepository
      .createQueryBuilder('project')
      .select('project.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('project.status')
      .getRawMany<{ status: string; count: string }>();

    const projectsByStatus = projectStatusRows.map((r) => ({
      status: r.status,
      count: Number(r.count),
    }));

    // Recent interactions (10)
    const recentInteractions = await this.interactionRepository.find({
      order: { interactionDate: 'DESC' },
      take: 10,
      relations: ['client', 'contact'],
    });

    return {
      totalClients,
      activeClients,
      clientsByStatus,
      clientsByOrigin,
      activeProjects,
      projectsByStatus,
      recentInteractions,
    };
  }
}