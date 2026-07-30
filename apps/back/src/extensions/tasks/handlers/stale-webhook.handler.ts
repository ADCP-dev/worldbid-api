/**
 * Stale Tasks Webhook — Handler
 *
 * Receives external alerts about stale tasks.
 * The webhook endpoint is auto-registered by the spec engine based on the spec YAML.
 *
 * In the full implementation, this handler would:
 * 1. Verify HMAC signature (if auth: hmac in spec)
 * 2. Parse the webhook payload
 * 3. Update the relevant task(s) or fire notifications
 */

import type { JobContext } from '@core/spec-engine/spec-job-runner';

export interface StaleWebhookPayload {
  taskId?: number;
  taskIds?: number[];
  staleSince: string; // ISO date
  message?: string;
}

export default async function staleWebhookHandler(
  payload: StaleWebhookPayload,
  ctx: JobContext,
): Promise<void> {
  ctx.logger.log(
    `Received stale webhook for tasks: ${payload.taskIds?.join(',') || payload.taskId || 'unknown'}`,
  );

  // In the full implementation:
  // 1. Look up tasks by ID
  // 2. Update status or add metadata flag
  // 3. Notify assignees

  ctx.logger.log(
    `Stale since: ${payload.staleSince}. Message: ${payload.message || 'none'}`,
  );
}