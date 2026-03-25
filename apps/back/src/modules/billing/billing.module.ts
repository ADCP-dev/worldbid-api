import { Module, DynamicModule } from '@nestjs/common';
import { StripeModule } from '@billing/stripe/stripe.module';

@Module({})
export class BillingModule {
  static register(): DynamicModule {
    return {
      module: BillingModule,
      imports: [StripeModule],
      exports: [StripeModule],
    };
  }
}
