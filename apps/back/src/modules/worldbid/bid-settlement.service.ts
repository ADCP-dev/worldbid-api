import { Injectable, Logger, Optional } from '@nestjs/common';
import Stripe from 'stripe';
import { BidsService } from './bids.service';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import { BidEntity } from './infrastructure/entities/bid.entity';

/**
 * Settles WorldBid ownership from Stripe checkout lifecycle events.
 *
 * Called by the stripe extension's webhook controller (single Stripe
 * ingress) after signature verification. Only checkout.session events
 * with a bidId in metadata are handled; everything else is ignored so
 * the same endpoint keeps serving subscription flows.
 */
@Injectable()
export class BidSettlementService {
  private readonly logger = new Logger(BidSettlementService.name);

  constructor(
    private readonly bidsService: BidsService,
    @Optional() private readonly queuedMailerService: QueuedMailerService,
  ) {}

  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.expired') {
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
      // ownership lost while checkout was open — refund happened server-side
      this.logger.warn(`bid ${bidId} confirmed but expired (outbid first)`);
      return;
    }
    await this.sendConfirmationEmail(bid);
  }

  /**
   * Confirm the paid bid. If the spot moved on while checkout was open,
   * confirmBidPaid marks it expired; Stripe refunds one-time payments
   * automatically when a session is not captured, so here we only log.
   */
  private async settleWithOutbidCheck(bidId: string): Promise<BidEntity | null> {
    await this.bidsService.confirmBidPaid(bidId);
    return this.bidsService.findBid(bidId);
  }

  private async sendConfirmationEmail(bid: BidEntity | null): Promise<void> {
    if (!bid?.email || !this.queuedMailerService) return;
    try {
      await this.queuedMailerService.sendMail({
        to: bid.email,
        subject:
          bid.countryId === 'PLANE'
            ? 'You own the WorldBid global banner'
            : `You now own ${bid.countryId} on WorldBid`,
        html: `<h2>Your bid was confirmed</h2>
<p>Hi ${bid.alias}, your $${Number(bid.amount).toFixed(2)} bid is now the top bid${
          bid.countryId === 'PLANE'
            ? ' on the global plane banner'
            : ` on spot ${bid.countryId}`
        }.</p>
<p>You own the spot until someone outbids you. Manage it at WorldBid.</p>`,
      });
    } catch (error: any) {
      this.logger.warn(`confirmation email not queued: ${error?.message}`);
    }
  }
}