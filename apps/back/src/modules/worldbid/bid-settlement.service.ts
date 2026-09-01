import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { BidsService } from './bids.service';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import { BidEntity } from './infrastructure/entities/bid.entity';
import { BidEmailRendererService } from './bid-email-renderer.service';
import { ConfigService } from '@nestjs/config';
import type { AllConfigType } from '@src/config/config.type';

/**
 * Settles WorldBid ownership from Stripe checkout lifecycle events.
 *
 * Called by the stripe extension's webhook fan-out (STRIPE_EVENT_LISTENERS)
 * after signature verification. Only checkout.session events with a bidId in
 * metadata are handled; everything else is ignored so the same endpoint keeps
 * serving subscription flows.
 */
@Injectable()
export class BidSettlementService {
  private readonly logger = new Logger(BidSettlementService.name);

  constructor(
    private readonly bidsService: BidsService,
    @Optional() private readonly queuedMailerService: QueuedMailerService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly emailRenderer: BidEmailRendererService,
  ) {}

  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    if (
      event.type !== 'checkout.session.completed' &&
      event.type !== 'checkout.session.expired'
    ) {
      return;
    }
    const session = event.data.object as Stripe.Checkout.Session;
    const bidId = session.metadata?.bidId;
    if (!bidId) return; // not a worldbid checkout

    if (event.type === 'checkout.session.expired') {
      await this.bidsService.expireBid(bidId);
      this.logger.log(`bid ${bidId} expired (checkout abandoned)`);
      return;
    }

    // checkout.session.completed — verify payment_status defensively
    if (session.payment_status !== 'paid') {
      this.logger.warn(
        `bid ${bidId}: checkout completed but payment_status=${session.payment_status}`,
      );
      return;
    }

    const bid = await this.settleWithOutbidCheck(bidId);
    if (bid && bid.status === 'expired') {
      this.logger.warn(`bid ${bidId} confirmed but expired (outbid first)`);
      return;
    }
    await this.sendBidEmail(bid, 'bid-confirmed');
  }

  /**
   * Confirm the paid bid. If the spot moved on while checkout was open,
   * confirmBidPaid marks it expired; the losing payment stays in Stripe
   * (refund flow is a payments-ops concern, logged here).
   */
  private async settleWithOutbidCheck(
    bidId: string,
  ): Promise<BidEntity | null> {
    await this.bidsService.confirmBidPaid(bidId);
    return this.bidsService.findBid(bidId);
  }

  private spotLabel(countryId: string): string {
    return countryId === 'PLANE'
      ? 'the global plane banner'
      : `the ${countryId} territory`;
  }

  /**
   * Styled Maizzle email (packages/emails/emails/worldbid-bid-*.vue).
   * Skipped silently when no mailer is available or the bid has no email.
   */
  private async sendBidEmail(
    bid: BidEntity | null,
    kind: 'bid-confirmed' | 'bid-outbid',
  ): Promise<void> {
    if (!bid?.email || !this.queuedMailerService) return;
    try {
      const rendered = await this.emailRenderer.render({
        to: bid.email,
        alias: bid.alias,
        kind: kind === 'bid-confirmed' ? 'confirmed' : 'outbid',
        spotLabel: this.spotLabel(bid.countryId),
        amount: `$${Number(bid.amount).toFixed(2)}`,
        appUrl: this.configService.get('app.frontendDomain', { infer: true }),
      });
      if (!rendered) return;
      const subject =
        kind === 'bid-confirmed'
          ? `Your WorldBid bid on ${this.spotLabel(bid.countryId)} is confirmed — $${Number(bid.amount).toFixed(2)}`
          : `You were outbid on ${this.spotLabel(bid.countryId)} — WorldBid`;
      await this.queuedMailerService.sendMail({
        to: bid.email,
        subject,
        html: rendered.html,
        text: rendered.text,
      });
    } catch (error: any) {
      this.logger.warn(`bid email not queued: ${error?.message}`);
    }
  }
}