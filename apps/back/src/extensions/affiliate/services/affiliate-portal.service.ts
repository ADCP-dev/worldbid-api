import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffiliatePartnerEntity } from '../infrastructure/persistence/entities/affiliate-partner.entity';
import { AffiliateReferralEntity } from '../infrastructure/persistence/entities/affiliate-referral.entity';
import { AffiliateCommissionEntity } from '../infrastructure/persistence/entities/affiliate-commission.entity';
import { CrmClientEntity } from '@ext/crm/infrastructure/persistence/entities/crm-client.entity';
import { CrmOriginEntity } from '@ext/crm/infrastructure/persistence/entities/crm-origin.entity';
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
  ) {}

  async findPartnerByUserId(
    userId: number,
  ): Promise<AffiliatePartnerEntity> {
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
    data: { name?: string; phone?: string; iban?: string },
  ): Promise<AffiliatePartnerEntity> {
    const partner = await this.findPartnerByUserId(userId);
    if (data.name !== undefined) partner.name = data.name;
    if (data.phone !== undefined) partner.phone = data.phone;
    if (data.iban !== undefined) partner.iban = data.iban;
    const saved = await this.partnerRepository.save(partner);
    this.logger.log(
      `Portal: partner id=${saved.id} (userId=${userId}) updated own profile`,
    );
    return saved;
  }

  async getPartnerReferrals(
    userId: number,
  ): Promise<AffiliateReferralEntity[]> {
    const partner = await this.findPartnerByUserId(userId);
    return this.referralRepository.find({
      where: { partnerId: partner.id },
      relations: ['client'],
      order: { referredAt: 'DESC' },
    });
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
    const origin = await this.findOrCreateAffiliateOrigin(partner.id, partner.name);

    // Resolve default status dynamically (don't hardcode id=1)
    const defaultStatus = await this.clientRepository.manager
      .findOne('ext_crm_status' as any, { where: { isDefault: true } } as any)
      .catch(() => null);
    const leadStatus = await this.clientRepository.manager
      .findOne('ext_crm_status' as any, { where: { name: 'lead' } } as any)
      .catch(() => null);
    const statusId = (defaultStatus as any)?.id ?? (leadStatus as any)?.id ?? 1;

    // Create a new CRM client (status resolved dynamically, origin=referral)
    const client = this.clientRepository.create({
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
    const savedClient = await this.clientRepository.save(client);
    this.logger.log(
      `Portal: created client id=${savedClient.id} for partner id=${partner.id}`,
    );

    // Create the affiliate_referral
    const referral = this.referralRepository.create({
      partnerId: partner.id,
      clientId: savedClient.id,
      originId: origin.id,
      status: 'pending',
      metadata: {
        notes: dto.notes ?? null,
        ...dto.metadata,
      },
    });
    const savedReferral = await this.referralRepository.save(referral);
    this.logger.log(
      `Portal: created referral id=${savedReferral.id} for partner id=${partner.id}, client id=${savedClient.id}`,
    );
    return savedReferral;
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
}