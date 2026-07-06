import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffiliatePartnerEntity } from '../infrastructure/persistence/entities/affiliate-partner.entity';
import { AffiliateReferralEntity } from '../infrastructure/persistence/entities/affiliate-referral.entity';
import { AffiliateCommissionEntity } from '../infrastructure/persistence/entities/affiliate-commission.entity';

@Injectable()
export class AffiliateDashboardService {
  private readonly logger = new Logger(AffiliateDashboardService.name);

  constructor(
    @InjectRepository(AffiliatePartnerEntity)
    private readonly partnerRepository: Repository<AffiliatePartnerEntity>,
    @InjectRepository(AffiliateReferralEntity)
    private readonly referralRepository: Repository<AffiliateReferralEntity>,
    @InjectRepository(AffiliateCommissionEntity)
    private readonly commissionRepository: Repository<AffiliateCommissionEntity>,
  ) {}

  async getDashboard(): Promise<{
    activePartners: number;
    pendingReferrals: number;
    pendingCommissionsTotal: number;
    paidCommissionsThisMonth: number;
    topPartners: Array<{
      partnerId: number;
      partnerName: string;
      totalRevenue: number;
    }>;
  }> {
    // Active partners count
    const activePartners = await this.partnerRepository.count({
      where: { isActive: true },
    });

    // Pending referrals count
    const pendingReferrals = await this.referralRepository.count({
      where: { status: 'pending' },
    });

    // Pending commissions total €
    const pendingResult = await this.commissionRepository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.commissionAmount), 0)', 'total')
      .where('c.status = :status', { status: 'pending' })
      .getRawOne<{ total: string }>();
    const pendingCommissionsTotal = Number(pendingResult?.total ?? 0);

    // Paid commissions this month €
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

    const paidResult = await this.commissionRepository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.commissionAmount), 0)', 'total')
      .where('c.status = :status', { status: 'paid' })
      .andWhere('c.paidAt >= :start', { start: monthStart })
      .andWhere('c.paidAt <= :end', { end: monthEnd })
      .getRawOne<{ total: string }>();
    const paidCommissionsThisMonth = Number(paidResult?.total ?? 0);

    // Top 5 partners by revenue (sum of commissionAmount where status=paid)
    const topRows = await this.commissionRepository
      .createQueryBuilder('c')
      .leftJoin('c.referral', 'r')
      .leftJoin('r.partner', 'p')
      .select('p.id', 'partnerId')
      .addSelect('p.name', 'partnerName')
      .addSelect('COALESCE(SUM(c.commissionAmount), 0)', 'totalRevenue')
      .where('c.status = :status', { status: 'paid' })
      .groupBy('p.id')
      .addGroupBy('p.name')
      .orderBy('totalRevenue', 'DESC')
      .limit(5)
      .getRawMany<{
        partnerId: number;
        partnerName: string;
        totalRevenue: string;
      }>();

    const topPartners = topRows.map((row) => ({
      partnerId: row.partnerId,
      partnerName: row.partnerName,
      totalRevenue: Number(row.totalRevenue ?? 0),
    }));

    this.logger.debug(
      `Dashboard: activePartners=${activePartners}, pendingReferrals=${pendingReferrals}, pendingCommissions=${pendingCommissionsTotal}, paidThisMonth=${paidCommissionsThisMonth}, topPartners=${topPartners.length}`,
    );

    return {
      activePartners,
      pendingReferrals,
      pendingCommissionsTotal,
      paidCommissionsThisMonth,
      topPartners,
    };
  }
}
