import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { AllConfigType } from '@src/config/config.type';

export const STRIPE_PROVIDER = 'STRIPE';

export const stripeProvider = {
  provide: STRIPE_PROVIDER,
  useFactory: (configService: ConfigService<AllConfigType>) => {
    const stripeConfig = configService.get('stripe', { infer: true });
    const secretKey = stripeConfig?.secretKey;

    if (!secretKey) {
      const logger = new Logger('StripeProvider');
      logger.warn('Stripe secret key not configured — returning null');
      return null;
    }

    return new Stripe(secretKey, {
      apiVersion: '2025-08-27.basil' as any,
    });
  },
  inject: [ConfigService],
};
