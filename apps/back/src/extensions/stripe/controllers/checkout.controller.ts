import {
  Controller,
  Post,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { StripeService } from '@ext/stripe/services/stripe.service';
import { UserId } from '@iam/auth/decorators/current-user.decorator';

@ApiTags('Stripe')
@Controller({
  path: 'stripe',
  version: '1',
})
@UseGuards(AuthGuard('jwt'))
export class CheckoutController {
  private readonly logger = new Logger(CheckoutController.name);

  constructor(private readonly stripeService: StripeService) {}

  @Post('checkout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async createCheckoutSession(@UserId() userId: number): Promise<{
    success: boolean;
    sessionId?: string;
    url?: string;
    error?: string;
  }> {
    try {
      const session = await this.stripeService.createCheckoutSessionForUser(
        userId,
        'default',
      );
      return {
        success: true,
        sessionId: session.id,
        url: session.url ?? undefined,
      };
    } catch (error: any) {
      this.logger.error(`Checkout session creation failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('portal')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async createCustomerPortal(@UserId() userId: number): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      const session =
        await this.stripeService.createCustomerPortalForUser(userId);
      return {
        success: true,
        url: session.url,
      };
    } catch (error: any) {
      this.logger.error(`Customer portal creation failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
