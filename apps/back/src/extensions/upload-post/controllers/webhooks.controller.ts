import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { WebhooksService } from '@ext/upload-post/services/webhooks.service';
import { WebhookConfigureDto } from '@ext/upload-post/dto/common.dto';

@ApiTags('Upload-Post')
@ApiBearerAuth()
@Controller({ path: 'upload-post/webhooks', version: '1' })
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

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
   * Verify with signature in production.
   */
  @Post('incoming')
  @HttpCode(HttpStatus.OK)
  handleIncoming(@Body() payload: any) {
    return this.webhooksService.handleWebhookEvent(payload);
  }
}