import { registerAs } from '@nestjs/config';

import { IsString, IsOptional } from 'class-validator';
import validateConfig from '@infra/utils/validate-config';
import { StripeConfig } from '@billing/stripe/config/stripe-config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY: string;

  @IsString()
  @IsOptional()
  STRIPE_PUBLISHABLE_KEY: string;

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET: string;

  @IsString()
  @IsOptional()
  FRONTEND_DOMAIN: string;
}

export default registerAs<StripeConfig>('stripe', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    frontendDomain: process.env.FRONTEND_DOMAIN,
  };
});
