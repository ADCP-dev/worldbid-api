import { Injectable, Logger } from '@nestjs/common';
import { StripeService } from './stripe.service';
import Stripe from 'stripe';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly stripeService: StripeService) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Delegating webhook event: ${event.type}`);
    return this.stripeService.handleWebhookEvent(event);
  }
}
