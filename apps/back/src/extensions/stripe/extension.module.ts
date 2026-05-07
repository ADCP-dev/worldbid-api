import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { ProductsService } from './services/products.service';
import { PricesService } from './services/prices.service';
import { PlansService } from './services/plans.service';
import { SubscriptionsService } from './services/subscriptions.service';
import { StripeService } from './services/stripe.service';
import { WebhooksService } from './services/webhooks.service';
import { PlanGuard } from './middleware/plan-guard';

@Module({
  imports: [
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
  ],
  providers: [
    ProductsService,
    PricesService,
    PlansService,
    SubscriptionsService,
    StripeService,
    WebhooksService,
    PlanGuard,
  ],
  exports: [
    ProductsService,
    PricesService,
    PlansService,
    SubscriptionsService,
    StripeService,
    PlanGuard,
  ],
})
export class StripeModule {}
