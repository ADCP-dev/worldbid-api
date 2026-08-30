import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffiliatePartnerEntity } from '../infrastructure/persistence/entities/affiliate-partner.entity';
import { AffiliatePartnerService } from './affiliate-partner.service';
import { AffiliateReferralEntity } from '../infrastructure/persistence/entities/affiliate-referral.entity';
import { AffiliateCommissionEntity } from '../infrastructure/persistence/entities/affiliate-commission.entity';
import { CrmClientEntity } from '@ext/crm/infrastructure/persistence/entities/crm-client.entity';
import { CrmOriginEntity } from '@ext/crm/infrastructure/persistence/entities/crm-origin.entity';
import { CrmStatusEntity } from '@ext/crm/infrastructure/persistence/entities/crm-status.entity';
import { PortalCreateReferralDto } from '../dto/portal-create-referral.dto';

@Injectable()
export class AffiliatePortalService {
  private readonly logger = new Logger(AffiliatePortalService.name);

  constructor(
    @InjectRepository(AffiliatePartnerEntity)
    private readonly partnerRepository: Repository<AffiliatePartnerEntity>,
    @InjectRepository(AffiliateReferralEntity)
    private readonly referralRepository: Repository<AffiliateReferralEntity>,
    @InjectRepository(AffiliateCommissionEntity)
    private readonly commissionRepository: Repository<AffiliateCommissionEntity>,
    @InjectRepository(CrmClientEntity)
    private readonly clientRepository: Repository<CrmClientEntity>,
    @InjectRepository(CrmOriginEntity)
    private readonly originRepository: Repository<CrmOriginEntity>,
    @InjectRepository(CrmStatusEntity)
    private readonly statusRepository: Repository<CrmStatusEntity>,
    private readonly partnerService: AffiliatePartnerService,
  ) {}

  async findPartnerByUserId(userId: number): Promise<AffiliatePartnerEntity> {
    const partner = await this.partnerRepository.findOne({
      where: { userId },
    });
    if (!partner) {
      throw new NotFoundException(
        `No affiliate partner linked to userId=${userId}`,
      );
    }
    return partner;
  }

  async getPartnerProfile(userId: number): Promise<AffiliatePartnerEntity> {
    return this.findPartnerByUserId(userId);
  }

  async updatePartnerProfile(
    userId: number,
    data: { phone?: string; iban?: string; companyName?: string },
  ): Promise<AffiliatePartnerEntity> {
    const partner = await this.findPartnerByUserId(userId);
    // Allowlist only. Identity (name/email/code) is admin-managed and never
    // editable from the portal.
    if (data.phone !== undefined) partner.phone = data.phone;
    if (data.iban !== undefined) partner.iban = data.iban;
    if (data.companyName !== undefined) partner.companyName = data.companyName;
    const saved = await this.partnerRepository.save(partner);
    this.logger.log(
      `Portal: partner id=${saved.id} (userId=${userId}) updated own profile`,
    );
    return saved;
  }

  async getPartnerReferrals(
    userId: number,
    page = 1,
    limit = 20,
  ): Promise<{
    data: AffiliateReferralEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const partner = await this.findPartnerByUserId(userId);
    const [data, total] = await this.referralRepository.findAndCount({
      where: { partnerId: partner.id },
      relations: ['client'],
      order: { referredAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async getPartnerReferral(
    userId: number,
    referralId: number,
  ): Promise<AffiliateReferralEntity> {
    const partner = await this.findPartnerByUserId(userId);
    const referral = await this.referralRepository.findOne({
      where: { id: referralId },
      relations: ['client', 'commissions'],
    });
    if (!referral) {
      throw new NotFoundException(`Referral with ID ${referralId} not found`);
    }
    if (referral.partnerId !== partner.id) {
      throw new ForbiddenException(
        `Referral ${referralId} does not belong to this partner`,
      );
    }
    return referral;
  }

  async createPortalReferral(
    userId: number,
    dto: PortalCreateReferralDto,
  ): Promise<AffiliateReferralEntity> {
    const partner = await this.findPartnerByUserId(userId);

    // Create or reuse an affiliate origin for this partner
    const origin = await this.findOrCreateAffiliateOrigin(
      partner.id,
      partner.name,
    );

    // Resolve default status using proper repository (not manager.findOne with string)
    const defaultStatus = await this.statusRepository.findOne({
      where: { isDefault: true },
    });
    const leadStatus = await this.statusRepository.findOne({
      where: { name: 'lead' },
    });
    const statusId = defaultStatus?.id ?? leadStatus?.id ?? 1;

    // Use transaction to avoid orphan client if referral creation fails
    return this.clientRepository.manager.transaction(async (manager) => {
      const client = manager.create(CrmClientEntity, {
        name: dto.client_name,
        companyName: dto.company_name ?? null,
        email: dto.email,
        phone: dto.phone ?? null,
        statusId,
        originId: origin.id,
        originDetail: `Affiliate referral from ${partner.name}`,
        metadata: {
          source: 'affiliate_portal',
          partner_id: partner.id,
          notes: dto.notes ?? null,
        },
        isActive: true,
      });
      const savedClient = await manager.save(client);
      this.logger.log(
        `Portal: created client id=${savedClient.id} for partner id=${partner.id}`,
      );

      const referral = manager.create(AffiliateReferralEntity, {
        partnerId: partner.id,
        clientId: savedClient.id,
        originId: origin.id,
        status: 'pending',
        metadata: { notes: dto.notes ?? null, ...dto.metadata },
      });
      const savedReferral = await manager.save(referral);
      this.logger.log(
        `Portal: created referral id=${savedReferral.id} for partner id=${partner.id}, client id=${savedClient.id}`,
      );
      return savedReferral;
    });
  }

  /**
   * Shared helper: find or create an affiliate origin for a partner.
   * Used by both portal and admin referral creation.
   */
  private async findOrCreateAffiliateOrigin(
    partnerId: number,
    partnerName: string,
  ): Promise<CrmOriginEntity> {
    const originName = `affiliate-partner-${partnerId}`;
    let origin = await this.originRepository.findOne({
      where: { name: originName },
    });
    if (!origin) {
      origin = this.originRepository.create({
        name: originName,
        label: `Affiliate: ${partnerName}`,
        type: 'affiliate',
        isActive: true,
        sortOrder: 100,
        metadata: { partner_id: partnerId },
      });
      origin = await this.originRepository.save(origin);
      this.logger.log(
        `Created affiliate origin id=${origin.id} for partner id=${partnerId}`,
      );
    } else {
      // Ensure metadata.partner_id is set
      const meta = (origin.metadata ?? {}) as Record<string, unknown>;
      if (meta.partner_id !== partnerId) {
        meta.partner_id = partnerId;
        origin.metadata = meta;
        await this.originRepository.save(origin);
      }
    }
    return origin;
  }

  async getPartnerCommissions(
    userId: number,
  ): Promise<AffiliateCommissionEntity[]> {
    const partner = await this.findPartnerByUserId(userId);

    return this.commissionRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.project', 'project')
      .leftJoin('c.referral', 'r')
      .where('r.partnerId = :partnerId', { partnerId: partner.id })
      .orderBy('c.createdAt', 'DESC')
      .getMany();
  }

  async getPartnerSummary(userId: number): Promise<{
    pendingTotal: number;
    approvedTotal: number;
    paidTotal: number;
    paidThisMonth: number;
  }> {
    const partner = await this.findPartnerByUserId(userId);

    const qb = this.commissionRepository
      .createQueryBuilder('c')
      .leftJoin('c.referral', 'r')
      .where('r.partnerId = :partnerId', { partnerId: partner.id });

    const pendingResult = await qb
      .clone()
      .select('COALESCE(SUM(c.commissionAmount), 0)', 'total')
      .andWhere('c.status = :status', { status: 'pending' })
      .getRawOne<{ total: string }>();
    const pendingTotal = Number(pendingResult?.total ?? 0);

    const approvedResult = await qb
      .clone()
      .select('COALESCE(SUM(c.commissionAmount), 0)', 'total')
      .andWhere('c.status = :status', { status: 'approved' })
      .getRawOne<{ total: string }>();
    const approvedTotal = Number(approvedResult?.total ?? 0);

    const paidResult = await qb
      .clone()
      .select('COALESCE(SUM(c.commissionAmount), 0)', 'total')
      .andWhere('c.status = :status', { status: 'paid' })
      .getRawOne<{ total: string }>();
    const paidTotal = Number(paidResult?.total ?? 0);

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
    const paidThisMonthResult = await qb
      .clone()
      .select('COALESCE(SUM(c.commissionAmount), 0)', 'total')
      .andWhere('c.status = :status', { status: 'paid' })
      .andWhere('c.paidAt >= :start', { start: monthStart })
      .andWhere('c.paidAt <= :end', { end: monthEnd })
      .getRawOne<{ total: string }>();
    const paidThisMonth = Number(paidThisMonthResult?.total ?? 0);

    return { pendingTotal, approvedTotal, paidTotal, paidThisMonth };
  }

  /**
   * Self-service pipeline for the affiliate portal: scoped to the partner
   * linked to the authenticated user. Reuses the admin pipeline query so the
   * data shape is identical (traceability: referral → budget → commission).
   */
  async getPartnerPipeline(userId: number) {
    const partner = await this.findPartnerByUserId(userId);
    const pipeline = await this.partnerService.getPipeline(partner.id);
    this.logger.log(
      `Portal: pipeline served for partner id=${partner.id} (userId=${userId})`,
    );
    return pipeline;
  }
}
