import { Injectable, Logger } from '@nestjs/common';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';

/**
 * Inbound webhook payload from Upload-Post.
 * An index signature lets any other field through without `any`.
 */
export interface WebhookPayload {
  event?: string;
  platform?: string;
  account_name?: string;
  reason?: string;
  result?: {
    success?: boolean;
    url?: string;
    publish_id?: string;
    error?: string;
  };
  [key: string]: unknown;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly client: UploadPostClientService) {}

  /**
   * Configure webhook notifications on Upload-Post.
   * Events: upload_completed, social_account_connected/disconnected/reauth_required
   */
  async configure(params: {
    webhookUrl: string;
    events?: {
      uploadCompleted?: boolean;
      socialAccountConnected?: boolean;
      socialAccountDisconnected?: boolean;
      socialAccountReauthRequired?: boolean;
    };
    telegramChatId?: string;
  }) {
    const events: Record<string, boolean> = {};
    if (params.events) {
      events.upload_completed = params.events.uploadCompleted ?? true;
      events.social_account_connected =
        params.events.socialAccountConnected ?? true;
      events.social_account_disconnected =
        params.events.socialAccountDisconnected ?? true;
      events.social_account_reauth_required =
        params.events.socialAccountReauthRequired ?? true;
    }

    return this.client.configureWebhooks({
      webhookUrl: params.webhookUrl,
      events,
      telegramChatId: params.telegramChatId,
    });
  }

  /**
   * Handle incoming webhook payload from Upload-Post.
   * Called by the controller's POST handler.
   */
  handleWebhookEvent(payload: WebhookPayload): {
    received: boolean;
    event: string;
  } {
    const event = payload?.event ?? 'unknown';
    this.logger.log(`Webhook received: ${event}`);

    switch (event) {
      case 'upload_completed':
        this.handleUploadCompleted(payload);
        break;
      case 'social_account_disconnected':
        this.logger.warn(
          `Social account disconnected: ${payload?.platform} / ${payload?.account_name} — reason: ${payload?.reason}`,
        );
        break;
      case 'social_account_reauth_required':
        this.logger.warn(
          `Reauth required: ${payload?.platform} / ${payload?.account_name}`,
        );
        break;
      case 'social_account_connected':
        this.logger.log(
          `Social account connected: ${payload?.platform} / ${payload?.account_name}`,
        );
        break;
      default:
        this.logger.log(`Unhandled event: ${event}`);
    }

    return { received: true, event };
  }

  private handleUploadCompleted(payload: WebhookPayload) {
    const result = payload?.result;
    if (result?.success) {
      this.logger.log(
        `Upload completed ✓ — ${payload?.platform}: ${result.url ?? result.publish_id}`,
      );
    } else {
      this.logger.error(
        `Upload failed ✗ — ${payload?.platform}: ${result?.error ?? 'unknown error'}`,
      );
    }
  }
}
