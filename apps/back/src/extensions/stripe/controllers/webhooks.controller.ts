import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { StripeService } from '../services/stripe.service';
import { AllConfigType } from '@src/config/config.type';

@ApiTags('Stripe')
@Controller({
  path: 'stripe/webhooks',
  version: '1',
})
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = this.configService.get('stripe', {
      infer: true,
    })?.webhookSecret;

    if (!webhookSecret) {
      this.logger.error('Stripe webhook secret not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    try {
      const event = this.stripeService.constructWebhookEvent(
        req.rawBody as Buffer,
        signature,
        webhookSecret,
      );

      await this.stripeService.handleWebhookEvent(event);

      return { received: true };
    } catch (error: any) {
      this.logger.error(`Webhook error: ${error.message}`);
      throw new BadRequestException(`Webhook error: ${error.message}`);
    }
  }
}
