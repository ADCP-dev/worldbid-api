import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);

  async createCustomer(user: {
    id: number;
    email: string;
  }): Promise<{ id: string }> {
    this.logger.log(`Creating Stripe customer for user ${user.id}`);
    return { id: 'cus_mock' };
  }

  async createCheckoutSession(
    userId: number,
    priceId: string,
  ): Promise<{ id: string; url: string }> {
    this.logger.log(
      `Creating checkout session for user ${userId} and price ${priceId}`,
    );
    return { id: 'cs_mock', url: 'https://stripe.com/mock-checkout' };
  }

  async syncProduct(product: {
    id: string;
    name: string;
  }): Promise<{ id: string }> {
    this.logger.log(`Syncing product ${product.id} to Stripe`);
    return { id: 'prod_mock' };
  }

  async syncPrice(price: {
    id: string;
    unitAmount: number;
  }): Promise<{ id: string }> {
    this.logger.log(`Syncing price ${price.id} to Stripe`);
    return { id: 'price_mock' };
  }
}
