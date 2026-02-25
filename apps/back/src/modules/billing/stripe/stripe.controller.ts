import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  Get,
  RawBodyRequest,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { StripeService } from '@billing/stripe/stripe.service';
import { AllConfigType } from '@src/config/config.type';
import { CreateCheckoutSessionDto } from '@billing/stripe/dto/create-checkout-session.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UserId } from '@iam/auth/decorators/current-user.decorator';
import { UsersService } from '@users/users.service';

@ApiTags('Stripe')
@Controller({
  path: 'stripe',
  version: '1',
})
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly usersService: UsersService,
  ) {}

  @Get('plans')
  async getPlans() {
    return await this.stripeService.getPlans();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('create-checkout-session')
  @HttpCode(HttpStatus.OK)
  async createCheckoutSession(
    @Body() createCheckoutSessionDto: CreateCheckoutSessionDto,
    @UserId() userId: number,
  ) {
    try {
      const session = await this.stripeService.createCheckoutSessionForUser(
        userId,
        createCheckoutSessionDto.lookupKey,
        createCheckoutSessionDto.metadata,
      );

      return {
        success: true,
        sessionId: session.id,
        url: session.url,
      };
    } catch (error) {
      this.logger.error(`Failed to create checkout session: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('create-customer-portal')
  @HttpCode(HttpStatus.OK)
  async createCustomerPortal(@UserId() userId: number) {
    try {
      const userDb = await this.usersService.findById(userId);
      if (!userDb || !userDb.stripeCustomerId) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      const portalSession =
        await this.stripeService.createCustomerPortalSession(
          userDb.stripeCustomerId,
        );

      return {
        success: true,
        url: portalSession.url,
      };
    } catch (error) {
      this.logger.error(`Failed to create customer portal: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('webhook')
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
      return {
        received: false,
        error: 'Webhook secret not configured',
      };
    }

    try {
      const event = this.stripeService.constructWebhookEvent(
        req.rawBody as Buffer,
        signature,
        webhookSecret as string,
      );

      await this.stripeService.handleWebhookEvent(event);

      return { received: true };
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`);
      return {
        received: false,
        error: error.message,
      };
    }
  }
}
