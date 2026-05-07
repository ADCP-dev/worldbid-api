import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  async handleEvent(event: {
    type: string;
    data: { object: Record<string, unknown> };
  }): Promise<void> {
    this.logger.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      default:
        this.logger.warn(`Unhandled webhook event type: ${event.type}`);
    }
  }

  private async handleCheckoutSessionCompleted(
    object: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(`Checkout session completed: ${object.id}`);
  }

  private async handleInvoicePaid(
    object: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(`Invoice paid: ${object.id}`);
  }

  private async handleSubscriptionUpdated(
    object: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(`Subscription updated: ${object.id}`);
  }
}
