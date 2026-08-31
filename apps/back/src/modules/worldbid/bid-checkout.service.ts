import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { AllConfigType } from '@src/config/config.type';
import { STRIPE_PROVIDER } from '@ext/stripe/stripe.provider';
import { BidEntity } from './infrastructure/entities/bid.entity';

/**
 * One-time-payment checkout sessions for WorldBid bids.
 *
 * Deliberately NOT the subscription-oriented StripeService of the stripe
 * extension: bids are single charges in 'payment' mode with per-bid metadata.
 * The extension's webhook endpoint stays the single Stripe ingress; the
 * worldbid webhook service subscribes to its outcome via onBidCheckoutEvent.
 */
@Injectable()
export class BidCheckoutService {
  private readonly logger = new Logger(BidCheckoutService.name);

  constructor(
    @Inject(STRIPE_PROVIDER) private readonly stripe: Stripe | null,
    private readonly configService: ConfigService<AllConfigType>,
    @InjectRepository(BidEntity)
    private readonly bidsRepository: Repository<BidEntity>,
  ) {}

  private get frontendDomain(): string {
    return (
      this.configService.get('stripe', { infer: true })?.frontendDomain ||
      'http://localhost:3000'
    );
  }

  get isConfigured(): boolean {
    return !!this.stripe;
  }

  /**
   * Create a one-time Stripe Checkout session for a pending bid.
   * Metadata carries bidId so the webhook can settle ownership.
   */
  async createCheckoutForBid(
    bid: BidEntity,
    customerEmail?: string | null,
  ): Promise<Stripe.Checkout.Session> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const amountCents = Math.round(Number(bid.amount) * 100);
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name:
                bid.countryId === 'PLANE'
                  ? 'WorldBid — Global plane banner'
                  : `WorldBid — spot ${bid.countryId}`,
              description:
                bid.countryId === 'PLANE'
                  ? 'Own the global banner until outbid.'
                  : `Own ${bid.countryId} until outbid (vitalicio).`,
            },
          },
        },
      ],
      customer_email: customerEmail || undefined,
      success_url: `${this.frontendDomain}/worldbid/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.frontendDomain}/worldbid/cancelled`,
      metadata: {
        bidId: bid.id,
        countryId: bid.countryId,
        amount: String(bid.amount),
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min to pay
    });

    await this.bidsRepository.update(
      { id: bid.id },
      { stripeSessionId: session.id },
    );
    return session;
  }

  /** Look up a bid by its Stripe checkout session id (webhook settlement). */
  async findBySessionId(sessionId: string): Promise<BidEntity | null> {
    return this.bidsRepository.findOne({ where: { stripeSessionId: sessionId } });
  }
}