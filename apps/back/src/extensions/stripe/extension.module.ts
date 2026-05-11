import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '@users/users.module';
import { ProductEntity } from './infrastructure/persistence/entities/product.entity';
import { PriceEntity } from './infrastructure/persistence/entities/price.entity';
import { PlanEntity } from './infrastructure/persistence/entities/plan.entity';
import { SubscriptionEntity } from './infrastructure/persistence/entities/subscription.entity';
import { UsageRecordEntity } from './infrastructure/persistence/entities/usage-record.entity';
import { ProductsController } from './controllers/products.controller';
import { PricesController } from './controllers/prices.controller';
import { PlansController } from './controllers/plans.controller';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { WebhooksController } from './controllers/webhooks.controller';
import { StripeTestController } from './controllers/stripe-test.controller';
import { CheckoutController } from './controllers/checkout.controller';
import { InvoicesController } from './controllers/invoices.controller';
import { ProductsService } from './services/products.service';
import { PricesService } from './services/prices.service';
import { PlansService } from './services/plans.service';
import { SubscriptionsService } from './services/subscriptions.service';
import { StripeService } from './services/stripe.service';
import { WebhooksService } from './services/webhooks.service';
import { PdfInvoiceService } from './services/pdf-invoice.service';
import { PlanGuard } from './middleware/plan-guard';
import { stripeProvider } from './stripe.provider';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    TypeOrmModule.forFeature([
      ProductEntity,
      PriceEntity,
      PlanEntity,
      SubscriptionEntity,
      UsageRecordEntity,
    ]),
  ],
  controllers: [
    ProductsController,
    PricesController,
    PlansController,
    SubscriptionsController,
    WebhooksController,
    StripeTestController,
    CheckoutController,
    InvoicesController,
  ],
  providers: [
    ProductsService,
    PricesService,
    PlansService,
    SubscriptionsService,
    StripeService,
    WebhooksService,
    PdfInvoiceService,
    PlanGuard,
    stripeProvider,
  ],
  exports: [
    ProductsService,
    PricesService,
    PlansService,
    SubscriptionsService,
    StripeService,
    WebhooksService,
    PdfInvoiceService,
    PlanGuard,
    stripeProvider,
  ],
})
export class StripeExtensionModule {}
