import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { StripeEventListener } from './webhooks.service';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { AllConfigType } from '@src/config/config.type';
import { UsersService } from '@users/users.service';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import { EmailDiscoveryService } from '@comms/mail/services/email-discovery.service';
import { PdfInvoiceService } from '@ext/stripe/services/pdf-invoice.service';
import { SubscriptionEntity } from '@ext/stripe/infrastructure/persistence/entities/subscription.entity';
import { PriceEntity } from '@ext/stripe/infrastructure/persistence/entities/price.entity';
import { PlanEntity } from '@ext/stripe/infrastructure/persistence/entities/plan.entity';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly domain: string;
  private readonly isStripeConfigured: boolean;

  constructor(
    @Inject('STRIPE') private readonly stripe: Stripe | null,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly usersService: UsersService,
    @Optional() private readonly queuedMailerService: QueuedMailerService,
    @Optional() private readonly emailDiscoveryService: EmailDiscoveryService,
    @Optional()
    @Inject('STRIPE_EVENT_LISTENERS')
    private readonly eventListeners?: StripeEventListener[][],
    private readonly pdfInvoiceService: PdfInvoiceService,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>,
    @InjectRepository(PriceEntity)
    private readonly priceRepository: Repository<PriceEntity>,
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
  ) {
    this.domain =
      this.configService.get('stripe', { infer: true })?.frontendDomain ||
      'http://localhost:3000';
    this.isStripeConfigured = !!this.stripe;
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
      name:
        [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
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
      subscription_data: {
        metadata: {
          userId: userId.toString(),
        },
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
        return_url: `${this.domain}/app/settings/profile`,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to create customer portal session: ${error.message}`,
      );
      throw error;
    }
  }

  async createCustomerPortalForUser(
    userId: number,
  ): Promise<Stripe.BillingPortal.Session> {
    if (!this.isStripeConfigured) {
      throw new Error('Stripe is not configured');
    }

    const user = await this.usersService.findById(userId);
    if (!user?.stripeCustomerId) {
      throw new Error('No Stripe customer found for this user');
    }

    return this.createCustomerPortalSession(user.stripeCustomerId);
  }

  async cancelSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    if (!this.isStripeConfigured) {
      throw new Error('Stripe is not configured');
    }

    try {
      return await this.stripe!.subscriptions.cancel(subscriptionId);
    } catch (error: any) {
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
    } catch (error: any) {
      this.logger.error(
        `Webhook signature verification failed: ${error.message}`,
      );
      throw error;
    }
  }

  async getInvoice(invoiceId: string): Promise<Stripe.Invoice | null> {
    if (!this.isStripeConfigured) return null;
    try {
      return await this.stripe!.invoices.retrieve(invoiceId);
    } catch {
      return null;
    }
  }

  async listInvoices(userId: number): Promise<Stripe.Invoice[]> {
    if (!this.isStripeConfigured) {
      return [];
    }

    const user = await this.usersService.findById(userId);
    if (!user?.stripeCustomerId) {
      return [];
    }

    try {
      const invoices = await this.stripe!.invoices.list({
        customer: user.stripeCustomerId,
        limit: 24,
      });
      return invoices.data;
    } catch (error: any) {
      this.logger.error(`Error listing invoices: ${error.message}`);
      return [];
    }
  }

  async getInvoicePdf(invoiceId: string): Promise<Buffer | null> {
    if (!this.isStripeConfigured) {
      return null;
    }

    try {
      const invoice = await this.stripe!.invoices.retrieve(invoiceId);
      if (!invoice.invoice_pdf) return null;

      const response = await fetch(invoice.invoice_pdf);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      this.logger.error(`Error getting invoice PDF: ${error.message}`);
      return null;
    }
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    if (!this.isStripeConfigured) {
      this.logger.warn('Received webhook event but Stripe is not configured');
      return;
    }

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    // Feature-module listeners (worldbid settlement etc.) — fired AFTER the
    // switch below so subscription bookkeeping lands first, but BEFORE the
    // method returns, and never fails the webhook (see WebhooksService).
    try {
      await this.dispatchToListeners(event);
    } catch (error: any) {
      this.logger.error(
        `stripe event listener failed for ${event.type}: ${error?.message}`,
      );
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
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
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    if (!this.isStripeConfigured) {
      return;
    }

    this.logger.log(`Checkout completed: ${session.id}`);

    const subscriptionId = session.subscription;
    if (!subscriptionId) {
      this.logger.warn('Checkout completed but no subscription ID found');
      return;
    }

    const userIdStr = session.metadata?.userId;
    if (!userIdStr) {
      this.logger.warn('Checkout completed but no userId in metadata');
      return;
    }

    const userId = parseInt(userIdStr, 10);

    try {
      // Check if subscription already exists in local DB
      const existing = await this.subscriptionRepository.findOne({
        where: { stripeId: subscriptionId as string },
      });

      if (existing) {
        this.logger.log(
          `Subscription ${subscriptionId} already exists locally`,
        );
        return;
      }

      // Retrieve full subscription from Stripe
      const subscription = await this.stripe!.subscriptions.retrieve(
        subscriptionId as string,
      );

      // Find the plan by price lookup
      const priceId = subscription.items.data[0]?.price.id;
      let plan: PlanEntity | null = null;
      if (priceId) {
        const price = await this.priceRepository.findOne({
          where: { stripeId: priceId },
          relations: ['plan'],
        });
        plan = (price as any)?.plan ?? null;
      }

      // Create local subscription
      const entity = this.subscriptionRepository.create({
        stripeId: subscription.id,
        userId,
        planId: plan?.id ?? null,
        status: this.mapSubscriptionStatus(subscription.status),
        currentPeriodStart: subscription.items.data[0]?.current_period_start
          ? new Date(subscription.items.data[0].current_period_start * 1000)
          : null,
        currentPeriodEnd: subscription.items.data[0]?.current_period_end
          ? new Date(subscription.items.data[0].current_period_end * 1000)
          : null,
        trialEnd: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      });

      await this.subscriptionRepository.save(entity);
      this.logger.log(
        `Subscription ${subscription.id} created for user ${userId}`,
      );
    } catch (error: any) {
      this.logger.error(`Error handling checkout completion: ${error.message}`);
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

      const userId = parseInt(customer.metadata?.userId, 10);
      if (!userId) {
        this.logger.error(
          `No userId found in customer metadata for ${subscription.customer}`,
        );
        return;
      }

      const stripePriceId =
        typeof subscription.items.data[0]?.price === 'string'
          ? subscription.items.data[0].price
          : subscription.items.data[0]?.price?.id;

      if (!stripePriceId) {
        this.logger.error(`No price found for subscription ${subscription.id}`);
        return;
      }

      const price = await this.priceRepository.findOne({
        where: { stripeId: stripePriceId },
      });

      if (!price) {
        this.logger.error(
          `Local price not found for Stripe price ${stripePriceId}`,
        );
        return;
      }

      const plan = await this.planRepository.findOne({
        where: { priceId: price.id },
      });

      if (!plan) {
        this.logger.error(`Local plan not found for price ${price.id}`);
        return;
      }

      let entity = await this.subscriptionRepository.findOne({
        where: { stripeId: subscription.id },
      });

      if (!entity) {
        entity = this.subscriptionRepository.create();
        entity.stripeId = subscription.id;
        entity.userId = userId;
        entity.planId = plan.id;
      }

      entity.status = this.mapSubscriptionStatus(subscription.status);

      const firstItem = subscription.items.data[0];
      entity.currentPeriodStart = firstItem?.current_period_start
        ? new Date(firstItem.current_period_start * 1000)
        : null;
      entity.currentPeriodEnd = firstItem?.current_period_end
        ? new Date(firstItem.current_period_end * 1000)
        : null;
      entity.cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
      entity.trialEnd = subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null;

      await this.subscriptionRepository.save(entity);
    } catch (error: any) {
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
      const entity = await this.subscriptionRepository.findOne({
        where: { stripeId: subscription.id },
      });

      if (!entity) {
        this.logger.warn(
          `Subscription ${subscription.id} not found in local DB for update`,
        );
        return;
      }

      entity.status = this.mapSubscriptionStatus(subscription.status);

      const firstItem = subscription.items.data[0];
      entity.currentPeriodStart = firstItem?.current_period_start
        ? new Date(firstItem.current_period_start * 1000)
        : null;
      entity.currentPeriodEnd = firstItem?.current_period_end
        ? new Date(firstItem.current_period_end * 1000)
        : null;
      entity.cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
      entity.trialEnd = subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null;

      await this.subscriptionRepository.save(entity);
    } catch (error: any) {
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
      const entity = await this.subscriptionRepository.findOne({
        where: { stripeId: subscription.id },
      });

      if (!entity) {
        this.logger.warn(
          `Subscription ${subscription.id} not found in local DB for deletion`,
        );
        return;
      }

      entity.status = 'canceled';
      entity.cancelAtPeriodEnd = true;
      await this.subscriptionRepository.save(entity);
    } catch (error: any) {
      this.logger.error(
        `Error handling subscription deletion: ${error.message}`,
      );
    }
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    if (!this.isStripeConfigured) return;

    this.logger.log(`Invoice paid: ${invoice.id}`);

    try {
      const subscriptionId = (invoice as any).subscription as
        | string
        | undefined;

      if (subscriptionId) {
        const entity = await this.subscriptionRepository.findOne({
          where: { stripeId: subscriptionId },
        });

        if (entity) {
          entity.status = 'active';
          await this.subscriptionRepository.save(entity);
          this.logger.log(
            `Subscription ${subscriptionId} status set to active`,
          );
        }
      }

      // Send invoice email with PDF
      const customerEmail = invoice.customer_email;
      if (customerEmail) {
        await this.sendInvoiceEmail(invoice, customerEmail);
      }
    } catch (error: any) {
      this.logger.error(`Error handling invoice paid: ${error.message}`);
    }
  }

  private async sendInvoiceEmail(
    invoice: Stripe.Invoice,
    to: string,
  ): Promise<void> {
    try {
      const currency = invoice.currency ?? 'eur';
      const total = invoice.total;
      const items = (invoice.lines?.data ?? []).map((line: any) => ({
        description: line.description ?? line.price?.nickname ?? 'Servicio',
        quantity: line.quantity ?? 1,
        unitPrice: line.price?.unit_amount ?? line.amount,
        amount: line.amount,
      }));

      if (!items.length) {
        items.push({
          description: invoice.billing_reason ?? 'Suscripción',
          quantity: 1,
          unitPrice: total,
          amount: total,
        });
      }

      const pdfBuffer = await this.pdfInvoiceService.generateInvoice({
        invoiceNumber: invoice.number ?? invoice.id!,
        invoiceDate: new Date(invoice.created * 1000).toLocaleDateString(
          'es-ES',
        ),
        dueDate: invoice.due_date
          ? new Date(invoice.due_date * 1000).toLocaleDateString('es-ES')
          : '—',
        customerName: invoice.customer_name ?? to,
        customerEmail: to,
        items,
        subtotal: invoice.subtotal,
        tax:
          (invoice as any).total_tax_amounts?.reduce(
            (s: number, t: any) => s + t.amount,
            0,
          ) ?? 0,
        total,
        currency,
        status: invoice.status ?? 'paid',
      });

      if (!this.queuedMailerService || !this.emailDiscoveryService) {
        this.logger.warn('Mailer services not available, skipping invoice email');
        return;
      }

      const templatePath = await this.emailDiscoveryService.resolveByName(
        'invoice',
      );
      if (!templatePath) {
        this.logger.warn('Invoice template not found, skipping invoice email');
        return;
      }

      const attachments = [
        {
          filename: `factura-${invoice.number ?? invoice.id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ];

      await this.queuedMailerService.sendMail({
        to,
        subject: `Factura ${invoice.number ?? invoice.id} - ${(total / 100).toFixed(2)} ${currency.toUpperCase()}`,
        templateName: 'invoice',
        config: {
          invoiceNumber: invoice.number ?? invoice.id!,
          amount: (total / 100).toFixed(2),
          currency: currency.toUpperCase(),
          subject: `Factura ${invoice.number ?? invoice.id}`,
        },
        attachments,
      } as never);

      this.logger.log(`Invoice email sent to ${to}`);
    } catch (error: any) {
      this.logger.error(`Failed to send invoice email: ${error.message}`);
    }
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    if (!this.isStripeConfigured) return;

    this.logger.log(`Invoice payment failed: ${invoice.id}`);

    try {
      const subscriptionId = (invoice as any).subscription as
        | string
        | undefined;
      if (!subscriptionId) return;

      const entity = await this.subscriptionRepository.findOne({
        where: { stripeId: subscriptionId },
      });

      if (entity) {
        entity.status = 'past_due';
        await this.subscriptionRepository.save(entity);
        this.logger.log(
          `Subscription ${subscriptionId} status set to past_due`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Error handling invoice payment failed: ${error.message}`,
      );
    }
  }

  private mapSubscriptionStatus(status: string): string {
    const allowed = [
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'trialing',
    ];
    if (allowed.includes(status)) return status;
    return 'incomplete';
  }

  private async dispatchToListeners(event: Stripe.Event): Promise<void> {
    for (const listener of this.eventListeners ?? []) {
      await listener.handleStripeEvent(event);
    }
  }
}
