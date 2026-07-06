import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffiliateReferralEntity } from '../infrastructure/persistence/entities/affiliate-referral.entity';
import { AffiliateCommissionEntity } from '../infrastructure/persistence/entities/affiliate-commission.entity';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import { AllConfigType } from '@src/config/config.type';

@Injectable()
export class AffiliateReportService {
  private readonly logger = new Logger(AffiliateReportService.name);

  constructor(
    @InjectRepository(AffiliateReferralEntity)
    private readonly referralRepository: Repository<AffiliateReferralEntity>,
    @InjectRepository(AffiliateCommissionEntity)
    private readonly commissionRepository: Repository<AffiliateCommissionEntity>,
    private readonly mailerService: QueuedMailerService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  /**
   * Runs on the last days of each month at 23:00.
   * Only sends an email if there were changes (new/updated referrals or commissions)
   * during the current month.
   */
  @Cron('0 23 28-31 * *')
  async handleMonthlyReport(): Promise<void> {
    try {
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
      this.logger.debug(`monthly report range: ${monthStart.toISOString()} → ${monthEnd.toISOString()}`);

      // Only run on actual last day of the month
      const lastDayOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      if (now.getDate() !== lastDayOfMonth) {
        this.logger.debug(
          `handleMonthlyReport: skipping (today is ${now.getDate()}, last day is ${lastDayOfMonth})`,
        );
        return;
      }

      // New referrals this month (use >= start AND < first of next month to avoid
      // losing records created at 23:59:59.999)
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const newReferrals = await this.referralRepository
        .createQueryBuilder('r')
        .where('r.createdAt >= :start', { start: monthStart })
        .andWhere('r.createdAt < :end', { end: nextMonthStart })
        .getCount();

      // Converted referrals this month (updatedAt within this month).
      // Use < nextMonthStart to avoid losing records updated at 23:59:59.999.
      const convertedReferralsThisMonth = await this.referralRepository
        .createQueryBuilder('r')
        .where('r.status = :status', { status: 'converted' })
        .andWhere('r.updatedAt >= :start', { start: monthStart })
        .andWhere('r.updatedAt < :nextStart', { nextStart: nextMonthStart })
        .getCount();

      // Commissions approved this month
      const commissionsApproved = await this.commissionRepository
        .createQueryBuilder('c')
        .where('c.status = :status', { status: 'approved' })
        .andWhere('c.updatedAt >= :start', { start: monthStart })
        .andWhere('c.updatedAt < :nextStart', { nextStart: nextMonthStart })
        .getCount();

      // Commissions paid this month
      const commissionsPaid = await this.commissionRepository
        .createQueryBuilder('c')
        .where('c.status = :status', { status: 'paid' })
        .andWhere('c.paidAt >= :start', { start: monthStart })
        .andWhere('c.paidAt < :nextStart', { nextStart: nextMonthStart })
        .getCount();

      const totalChanges =
        newReferrals +
        convertedReferralsThisMonth +
        commissionsApproved +
        commissionsPaid;

      if (totalChanges === 0) {
        this.logger.log(
          'handleMonthlyReport: no changes this month, skipping email',
        );
        return;
      }

      const monthName = now.toLocaleString('default', { month: 'long' });

      const html = `
<h2>Affiliate Monthly Report — ${monthName} ${now.getFullYear()}</h2>
<ul>
  <li><strong>New referrals:</strong> ${newReferrals}</li>
  <li><strong>Converted referrals:</strong> ${convertedReferralsThisMonth}</li>
  <li><strong>Commissions approved:</strong> ${commissionsApproved}</li>
  <li><strong>Commissions paid:</strong> ${commissionsPaid}</li>
</ul>
<p>This report was generated automatically.</p>`;

      const text = `Affiliate Monthly Report — ${monthName} ${now.getFullYear()}

New referrals: ${newReferrals}
Converted referrals: ${convertedReferralsThisMonth}
Commissions approved: ${commissionsApproved}
Commissions paid: ${commissionsPaid}

This report was generated automatically.`;

      const notificationEmail =
        this.configService.get('app', { infer: true })?.notificationEmail ||
        process.env.AFFILIATE_REPORT_EMAIL;

      if (!notificationEmail) {
        this.logger.warn(
          'No notification email configured — skipping monthly report',
        );
        return;
      }

      await this.mailerService.sendMail({
        to: notificationEmail,
        subject: `Affiliate Monthly Report — ${monthName} ${now.getFullYear()}`,
        html,
        text,
      });

      this.logger.log(
        `handleMonthlyReport: sent monthly report email — newReferrals=${newReferrals}, converted=${convertedReferralsThisMonth}, approved=${commissionsApproved}, paid=${commissionsPaid}`,
      );
    } catch (err) {
      this.logger.error(`handleMonthlyReport failed: ${err?.message ?? err}`);
    }
  }
}
