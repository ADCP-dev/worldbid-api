import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StripeService } from '@billing/stripe/stripe.service';
import { StripeController } from '@billing/stripe/stripe.controller';
import { AllConfigType } from '@src/config/config.type';
import { UsersModule } from '@users/users.module';
import Stripe from 'stripe';

@Module({
  imports: [ConfigModule, UsersModule],
  controllers: [StripeController],
  providers: [
    StripeService,
    {
      provide: 'STRIPE',
      useFactory: (configService: ConfigService<AllConfigType>) => {
        const stripeConfig = configService.get('stripe', { infer: true });
        const secretKey = stripeConfig?.secretKey;

        if (!secretKey) {
          return null;
        }

        return new Stripe(secretKey, {
          apiVersion: '2025-08-27.basil',
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [StripeService],
})
export class StripeModule {}
