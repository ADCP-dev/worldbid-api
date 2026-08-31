import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { StripeService } from './stripe.service';
import Stripe from 'stripe';

/**
 * Listener contract for feature modules that need verified Stripe events
 * (e.g. worldbid settlement). Registered via the STRIPE_EVENT_LISTENERS
 * multi-provider; failures are logged and never fail the webhook.
 */
export interface StripeEventListener {
  handleStripeEvent(event: Stripe.Event): Promise<void>;
}

export const STRIPE_EVENT_LISTENERS = 'STRIPE_EVENT_LISTENERS';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly stripeService: StripeService,
    @Optional() @Inject(STRIPE_EVENT_LISTENERS) private readonly listeners?: StripeEventListener[][],
  ) {}

  /**
   * Full dispatch: extension handling ({@link StripeService}) first, then
   * every registered feature-module listener. Kept for callers that want
   * controller-level dispatch (unused by the current controller, which calls
   * StripeService directly — the real listener fan-out lives there too).
   */
  async handleEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Delegating webhook event: ${event.type}`);
    await this.stripeService.handleWebhookEvent(event);
    await this.dispatchToListeners(event);
  }

  /**
   * Listener fan-out used by StripeService after its own handling. Swallows
   * listener errors so a failing feature module never 5xx-acks the webhook
   * (Stripe would otherwise retry indefinitely).
   */
  async dispatchToListeners(event: Stripe.Event): Promise<void> {
    for (const listener of this.listeners ?? []) {
      try {
        await listener.handleStripeEvent(event);
      } catch (error: any) {
        this.logger.error(
          `stripe event listener failed for ${event.type}: ${error?.message}`,
        );
      }
    }
  }
}