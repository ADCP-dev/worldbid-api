/**
 * Status Change Webhook Handler
 *
 * Receives external alerts when a task changes status. The webhook endpoint
 * is auto-registered by the spec engine (auth: hmac).
 *
 * Introduced by change `spec-engine-v2-frontend-and-loader` (Slice 7) as part
 * of the canonical example redesign. Implementation is intentionally minimal:
 * it logs the payload and records the event in the error tracker for
 * visibility.
 */

import type { HookContext } from '@core/spec-engine/spec.types';

export default async function statusChangeWebhookHandler(
  payload: Record<string, unknown>,
  ctx: HookContext,
): Promise<void> {
  const taskId = payload.taskId;
  const from = payload.from;
  const to = payload.to;

  ctx.logger.log(
    `Received status-change webhook for task ${taskId}: ${from} → ${to}`,
  );

  await ctx.logError(
    `Status change alert received for task ${taskId} (${from} → ${to})`,
    'spec-engine:tasks:status-change-webhook',
    { taskId, from, to },
  );
}
