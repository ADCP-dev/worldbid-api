import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { AllConfigType } from '../config/config.type';
import { UsersService } from '../users/users.service';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly domain: string;
  private readonly isStripeConfigured: boolean;

  constructor(
    @Inject('STRIPE') private readonly stripe: Stripe | null,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly usersService: UsersService,
  ) {
    this.domain =
      this.configService.get('stripe', { infer: true })?.frontendDomain ||
      'http://localhost:3000';
    this.isStripeConfigured = !!this.stripe;
  }

  async getPlans() {
    if (!this.isStripeConfigured) {
      throw new Error('Stripe is not configured');
    }
    return await this.stripe!.plans.list({
      expand: ['data.product'],
    });
  }

  async createOrRetrieveCustomer(userId: number): Promise<string> {
    if (!this.isStripeConfigured) {
      throw new Error('Stripe is not configured');
    }

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new Error(`User with id ${userId} not found`);
    }

    if (user?.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripe!.customers.create({
      email: user.email as string,
      name: user.firstName + ' ' + user.lastName || undefined,
      metadata: {
        userId: userId.toString(),
      },
    });

    await this.usersService.update(userId, { stripeCustomerId: customer.id });
    return customer.id;
  }

  async createCheckoutSessionForUser(
    userId: number,
    lookupKey: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Checkout.Session> {
    if (!this.isStripeConfigured) {
      throw new Error('Stripe is not configured');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const customerId = await this.createOrRetrieveCustomer(userId);

    const prices = await this.stripe!.prices.list({
      lookup_keys: [lookupKey],
      expand: ['data.product'],
    });

    if (!prices.data.length) {
      throw new Error(`Price with lookup key ${lookupKey} not found`);
    }

    return await this.stripe!.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [
        {
          price: prices.data[0].id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${this.domain}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.domain}/cancel`,
      customer: customerId,
      metadata: {
        userId: userId.toString(),
        ...metadata,
      },
    });
  }

  async createCustomerPortalSession(
    customerId: string,
  ): Promise<Stripe.BillingPortal.Session> {
    if (!this.isStripeConfigured) {
      throw new Error('Stripe is not configured');
    }

    try {
      return await this.stripe!.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${this.domain}/settings/profile`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to create customer portal session: ${error.message}`,
      );
      throw error;
    }
  }

  async cancelSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    if (!this.isStripeConfigured) {
      throw new Error('Stripe is not configured');
    }

    try {
      return await this.stripe!.subscriptions.cancel(subscriptionId);
    } catch (error) {
      this.logger.error(`Failed to cancel subscription: ${error.message}`);
      throw error;
    }
  }

  constructWebhookEvent(
    payload: Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    if (!this.isStripeConfigured) {
      throw new Error('Stripe is not configured');
    }

    try {
      return this.stripe!.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      this.logger.error(
        `Webhook signature verification failed: ${error.message}`,
      );
      throw error;
    }
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    if (!this.isStripeConfigured) {
      this.logger.warn('Received webhook event but Stripe is not configured');
      return;
    }

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      // case 'customer.subscription.trial_will_end':
      //   await this.handleSubscriptionTrialWillEnd(
      //     event.data.object as Stripe.Subscription,
      //   );
      //   break;
      // case 'invoice.payment_succeeded':
      //   await this.handleInvoicePaymentSucceeded(
      //     event.data.object as Stripe.Invoice,
      //   );
      //   break;
      // case 'invoice.payment_failed':
      //   await this.handleInvoicePaymentFailed(
      //     event.data.object as Stripe.Invoice,
      //   );
      //   break;
      // case 'checkout.session.completed':
      //   await this.handleCheckoutSessionCompleted(
      //     event.data.object as Stripe.Checkout.Session,
      //   );
      //   break;
      // case 'customer.created':
      //   await this.handleCustomerCreated(event.data.object as Stripe.Customer);
      //   break;
      // case 'customer.updated':
      //   await this.handleCustomerUpdated(event.data.object as Stripe.Customer);
      //   break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleSubscriptionCreated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    if (!this.isStripeConfigured) {
      return;
    }

    this.logger.log(
      `Subscription created: ${subscription.id} for customer ${subscription.customer}`,
    );

    try {
      const customer = await this.stripe!.customers.retrieve(
        subscription.customer as string,
      );

      if (customer.deleted) {
        this.logger.error(`Customer ${subscription.customer} has been deleted`);
        return;
      }

      const userId = parseInt(customer.metadata?.userId);
      if (!userId) {
        this.logger.error(
          `No userId found in customer metadata for ${subscription.customer}`,
        );
        return;
      }

      const productId = subscription.items.data[0]?.price?.product as string;
      if (!productId) {
        this.logger.error(
          `No product found for subscription ${subscription.id}`,
        );
        return;
      }

      const product = await this.stripe!.products.retrieve(productId);
      if (!product.metadata) {
        this.logger.error(`No metadata found for product ${productId}`);
        return;
      }

      // const subscriptionStartDate = new Date(
      //   subscription.items.data[0].current_period_start * 1000,
      // );
      // const subscriptionEndDate = new Date(
      //   subscription.items.data[0].current_period_end * 1000,
      // );

      // const metadata = product.metadata;

      // ADD LOGIC FOR THE SUBSCRIPTION PAYMENT
    } catch (error) {
      this.logger.error(
        `Error handling subscription creation: ${error.message}`,
      );
    }
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    if (!this.isStripeConfigured) {
      return;
    }

    this.logger.log(
      `Subscription updated: ${subscription.id} status: ${subscription.status}`,
    );

    try {
      const customer = await this.stripe!.customers.retrieve(
        subscription.customer as string,
      );

      if (customer.deleted) {
        this.logger.error(`Customer ${subscription.customer} has been deleted`);
        return;
      }

      const userId = parseInt(customer.metadata?.userId);
      if (!userId) {
        this.logger.error(
          `No userId found in customer metadata for ${subscription.customer}`,
        );
        return;
      }

      // Handle subscription renewal or plan change
      if (subscription.status === 'active') {
        const productId = subscription.items.data[0]?.price?.product as string;
        if (!productId) {
          this.logger.error(
            `No product found for subscription ${subscription.id}`,
          );
          return;
        }

        const product = await this.stripe!.products.retrieve(productId);
        if (!product.metadata) {
          this.logger.error(`No metadata found for product ${productId}`);
          return;
        }

        // const subscriptionStartDate = new Date(
        //   subscription.items.data[0].current_period_start * 1000,
        // );
        // const subscriptionEndDate = new Date(
        //   subscription.items.data[0].current_period_end * 1000,
        // );

        // const metadata = product.metadata;

        // ADD LOGIC FOR THE SUBSCRIPTION PAYMENT UPDATE
      }
    } catch (error) {
      this.logger.error(`Error handling subscription update: ${error.message}`);
    }
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    if (!this.isStripeConfigured) {
      return;
    }

    this.logger.log(`Subscription deleted: ${subscription.id}`);

    try {
      const customer = await this.stripe!.customers.retrieve(
        subscription.customer as string,
      );

      if (customer.deleted) {
        this.logger.error(`Customer ${subscription.customer} has been deleted`);
        return;
      }

      const userId = parseInt(customer.metadata?.userId);
      if (!userId) {
        this.logger.error(
          `No userId found in customer metadata for ${subscription.customer}`,
        );
        return;
      }

      // Handle subscription cancellation
      if (subscription.status === 'canceled') {
        // ADD LOGIC FOR THE SUBSCRIPTION PAYMENT CANCELLATION
      }
    } catch (error) {
      this.logger.error(
        `Error handling subscription deletion: ${error.message}`,
      );
    }
  }

  // private async handleSubscriptionTrialWillEnd(
  //   subscription: Stripe.Subscription,
  // ): Promise<void> {
  //   this.logger.log(`Subscription trial ending: ${subscription.id}`);
  //   // TODO: Implement business logic for trial ending
  // }

  // private async handleInvoicePaymentSucceeded(
  //   invoice: Stripe.Invoice,
  // ): Promise<void> {
  //   this.logger.log(`Payment succeeded for invoice: ${invoice.id}`);
  //   // TODO: Implement business logic for successful payment
  // }

  // private async handleInvoicePaymentFailed(
  //   invoice: Stripe.Invoice,
  // ): Promise<void> {
  //   this.logger.log(`Payment failed for invoice: ${invoice.id}`);
  //   // TODO: Implement business logic for failed payment
  // }

  // private async handleCheckoutSessionCompleted(
  //   session: Stripe.Checkout.Session,
  // ): Promise<void> {
  //   this.logger.log(
  //     `Checkout session completed: ${session.id} for customer ${session.customer}`,
  //   );
  //   // Add your business logic here (e.g., activate subscription, send welcome email)
  // }

  // private async handleCustomerCreated(
  //   customer: Stripe.Customer,
  // ): Promise<void> {
  //   this.logger.log(
  //     `Customer created: ${customer.id} with email ${customer.email}`,
  //   );
  //   // Add your business logic here (e.g., create user record, send welcome email)
  // }

  // private async handleCustomerUpdated(
  //   customer: Stripe.Customer,
  // ): Promise<void> {
  //   this.logger.log(
  //     `Customer updated: ${customer.id} with email ${customer.email}`,
  //   );
  //   // Add your business logic here (e.g., update user record)
  // }
}
