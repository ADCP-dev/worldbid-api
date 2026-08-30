import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';
import { UpPostEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post.entity';

/**
 * Inbound webhook payload from Upload-Post.
 * An index signature lets any other field through without `any`.
 */
export interface WebhookPayload {
  event?: string;
  platform?: string;
  account_name?: string;
  reason?: string;
  request_id?: string;
  job_id?: string;
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

  constructor(
    private readonly client: UploadPostClientService,
    @InjectRepository(UpPostEntity)
    private readonly postRepo: Repository<UpPostEntity>,
  ) {}

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
  async handleWebhookEvent(payload: WebhookPayload): Promise<{
    received: boolean;
    event: string;
  }> {
    const event = payload?.event ?? 'unknown';
    this.logger.log(`Webhook received: ${event}`);

    switch (event) {
      case 'upload_completed':
        await this.handleUploadCompleted(payload);
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

  /**
   * upload_completed → sync the matching local UpPostEntity row (by request_id,
   * falling back to job_id for scheduled posts) with per-platform results.
   */
  private async handleUploadCompleted(payload: WebhookPayload): Promise<void> {
    const result = payload?.result;
    const platform = payload?.platform ?? 'unknown';

    if (result?.success) {
      this.logger.log(
        `Upload completed ✓ — ${platform}: ${result.url ?? result.publish_id}`,
      );
    } else {
      this.logger.error(
        `Upload failed ✗ — ${platform}: ${result?.error ?? 'unknown error'}`,
      );
    }

    const identifier = payload?.request_id
      ? { requestId: payload.request_id }
      : payload?.job_id
        ? { jobId: payload.job_id }
        : null;
    if (!identifier) {
      this.logger.warn(
        'upload_completed without request_id/job_id — skipping sync',
      );
      return;
    }

    const local = await this.postRepo.findOne({
      where: identifier,
    });
    if (!local) {
      this.logger.warn(
        `upload_completed: no local record for ${JSON.stringify(identifier)}`,
      );
      return;
    }

    const platformResults = { ...(local.results ?? {}) };
    platformResults[platform] = {
      success: Boolean(result?.success),
      url: result?.url,
      error: result?.error,
      publishId: result?.publish_id,
    };
    local.results = platformResults;

    const platformList = local.platforms ?? [];
    const allFailed =
      platformList.length > 0 &&
      platformList.every((p) => platformResults[p]?.success === false);
    const allDone =
      platformList.length > 0 &&
      platformList.every((p) => platformResults[p]?.success !== undefined);

    if (allFailed) {
      local.status = 'error';
      local.errorMessage =
        result?.error ?? `Upload failed on platform "${platform}"`;
    } else if (allDone) {
      local.status = 'success';
      local.publishedAt = new Date();
      local.errorMessage = null;
    }

    await this.postRepo.save(local);
    this.logger.log(
      `Synced UpPostEntity ${local.id} from webhook — status=${local.status}`,
    );
  }
}
