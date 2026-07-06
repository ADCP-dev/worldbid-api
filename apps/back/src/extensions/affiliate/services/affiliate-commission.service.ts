import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffiliateCommissionEntity } from '../infrastructure/persistence/entities/affiliate-commission.entity';
import { AffiliateReferralEntity } from '../infrastructure/persistence/entities/affiliate-referral.entity';
import { CrmProjectEntity } from '@ext/crm/infrastructure/persistence/entities/crm-project.entity';
import { CreateCommissionDto } from '../dto/create-commission.dto';
import { UpdateCommissionDto } from '../dto/update-commission.dto';

const VALID_STATUSES = ['pending', 'approved', 'paid'];

@Injectable()
export class AffiliateCommissionService {
  private readonly logger = new Logger(AffiliateCommissionService.name);

  constructor(
    @InjectRepository(AffiliateCommissionEntity)
    private readonly repository: Repository<AffiliateCommissionEntity>,
    @InjectRepository(AffiliateReferralEntity)
    private readonly referralRepository: Repository<AffiliateReferralEntity>,
    @InjectRepository(CrmProjectEntity)
    private readonly projectRepository: Repository<CrmProjectEntity>,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    partnerId?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<{
    data: AffiliateCommissionEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, partnerId, status, dateFrom, dateTo } =
      params;

    const qb = this.repository.createQueryBuilder('commission');
    qb.leftJoinAndSelect('commission.referral', 'referral');
    qb.leftJoinAndSelect('referral.partner', 'partner');
    qb.leftJoinAndSelect('commission.project', 'project');

    if (partnerId) {
      qb.andWhere('referral.partnerId = :partnerId', { partnerId });
    }
    if (status) {
      qb.andWhere('commission.status = :status', { status });
    }
    if (dateFrom) {
      qb.andWhere('commission.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('commission.createdAt <= :dateTo', { dateTo });
    }

    qb.orderBy('commission.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    this.logger.debug(
      `findAll: returned ${data.length} of ${total} commissions (page ${page}, limit ${limit})`,
    );

    return { data, total, page, limit };
  }

  async findOne(id: number): Promise<AffiliateCommissionEntity> {
    const commission = await this.repository.findOne({
      where: { id },
      relations: ['referral', 'referral.partner', 'project'],
    });
    if (!commission) {
      throw new NotFoundException(`Commission with ID ${id} not found`);
    }
    return commission;
  }

  async create(dto: CreateCommissionDto): Promise<AffiliateCommissionEntity> {
    const referral = await this.referralRepository.findOne({
      where: { id: dto.referralId },
      relations: ['partner'],
    });
    if (!referral) {
      throw new NotFoundException(
        `Referral with ID ${dto.referralId} not found`,
      );
    }

    const project = await this.projectRepository.findOne({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException(
        `Project with ID ${dto.projectId} not found`,
      );
    }

    // Check for duplicate commission (referralId + projectId)
    const existing = await this.repository.findOne({
      where: { referralId: dto.referralId, projectId: dto.projectId },
    });
    if (existing) {
      throw new BadRequestException(
        `Commission already exists for referral ${dto.referralId} and project ${dto.projectId}`,
      );
    }

    // Validate project is paid
    if (project.paymentStatus !== 'paid') {
      throw new BadRequestException(
        `Project ${project.id} paymentStatus is '${project.paymentStatus}', must be 'paid' to create a commission`,
      );
    }

    const baseAmount = Number(project.price ?? 0);
    const commissionRate = Number(referral.partner.commissionRate);
    const commissionAmount = Number(
      (baseAmount * commissionRate).toFixed(2),
    );

    const commission = this.repository.create({
      referralId: dto.referralId,
      projectId: dto.projectId,
      baseAmount,
      commissionRate,
      commissionAmount,
      status: dto.status ?? 'pending',
      metadata: dto.metadata ?? {},
    });
    const saved = await this.repository.save(commission);
    this.logger.log(
      `Created commission id=${saved.id} — base=${baseAmount}, rate=${commissionRate}, amount=${commissionAmount}`,
    );
    return saved;
  }

  async update(
    id: number,
    dto: UpdateCommissionDto,
  ): Promise<AffiliateCommissionEntity> {
    const commission = await this.findOne(id);

    if (dto.status) {
      if (!VALID_STATUSES.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid status '${dto.status}'. Valid values: ${VALID_STATUSES.join(', ')}`,
        );
      }

      // If transitioning to "paid", set paidAt
      if (dto.status === 'paid' && commission.status !== 'paid') {
        commission.paidAt = new Date();
      }
      commission.status = dto.status;
    }
    if (dto.metadata) {
      commission.metadata = { ...commission.metadata, ...dto.metadata };
    }

    const saved = await this.repository.save(commission);
    this.logger.log(`Updated commission id=${id}, status=${saved.status}`);
    return saved;
  }

  async getSummary(): Promise<{
    pendingTotal: number;
    approvedTotal: number;
    paidTotalThisMonth: number;
  }> {
    // Pending total
    const pendingResult = await this.repository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.commissionAmount), 0)', 'total')
      .where('c.status = :status', { status: 'pending' })
      .getRawOne<{ total: string }>();
    const pendingTotal = Number(pendingResult?.total ?? 0);

    // Approved total
    const approvedResult = await this.repository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.commissionAmount), 0)', 'total')
      .where('c.status = :status', { status: 'approved' })
      .getRawOne<{ total: string }>();
    const approvedTotal = Number(approvedResult?.total ?? 0);

    // Paid this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const paidResult = await this.repository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.commissionAmount), 0)', 'total')
      .where('c.status = :status', { status: 'paid' })
      .andWhere('c.paidAt >= :start', { start: monthStart })
      .andWhere('c.paidAt <= :end', { end: monthEnd })
      .getRawOne<{ total: string }>();
    const paidTotalThisMonth = Number(paidResult?.total ?? 0);

    return { pendingTotal, approvedTotal, paidTotalThisMonth };
  }
}