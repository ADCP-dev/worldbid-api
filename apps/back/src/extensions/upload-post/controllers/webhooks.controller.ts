import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { ConfigService } from '@nestjs/config';
import { WebhooksService } from '@ext/upload-post/services/webhooks.service';
import type { WebhookPayload } from '@ext/upload-post/services/webhooks.service';
import { WebhookConfigureDto } from '@ext/upload-post/dto/common.dto';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

const webhookLogger = new Logger('WebhooksController');

@ApiTags('Upload-Post')
@ApiBearerAuth()
@Controller({ path: 'upload-post/webhooks', version: '1' })
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly configService: ConfigService,
  ) {}

  @Post('configure')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @HttpCode(HttpStatus.OK)
  configure(@Body() dto: WebhookConfigureDto) {
    return this.webhooksService.configure({
      webhookUrl: dto.webhookUrl,
      telegramChatId: dto.telegramChatId,
      events: dto.events,
    });
  }

  /**
   * Inbound webhook from Upload-Post. Public endpoint — no auth guard.
   * Validates HMAC signature if UPLOAD_POST_WEBHOOK_SECRET is configured.
   */
  @Post('incoming')
  @HttpCode(HttpStatus.OK)
  handleIncoming(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: WebhookPayload,
  ) {
    const secret = this.configService.get('upload-post', { infer: true })?.webhookSecret;

    if (secret) {
      const signature = req.headers['x-upload-post-signature'] as string | undefined;
      if (!signature) {
        webhookLogger.warn('Webhook incoming: missing X-Upload-Post-Signature header');
        throw new UnauthorizedException('Missing signature header');
      }

      const rawBody: Buffer | undefined = req.rawBody;
      if (!rawBody) {
        webhookLogger.warn('Webhook incoming: raw body not available');
        throw new UnauthorizedException('Missing raw body');
      }

      const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

      // Timing-safe comparison to prevent timing attacks
      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expected);
      if (
        sigBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        webhookLogger.warn('Webhook incoming: invalid signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } else {
      webhookLogger.warn(
        'Webhook incoming: UPLOAD_POST_WEBHOOK_SECRET not configured — accepting without signature verification',
      );
    }

    return this.webhooksService.handleWebhookEvent(payload);
  }
}