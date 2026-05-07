import { Controller, Post, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WebhooksService } from '../services/webhooks.service';

@ApiTags('Stripe')
@Controller({
  path: 'stripe/webhooks',
  version: '1',
})
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() event: { type: string; data: { object: Record<string, unknown> } },
  ) {
    await this.webhooksService.handleEvent(event);
    return { received: true };
  }
}
