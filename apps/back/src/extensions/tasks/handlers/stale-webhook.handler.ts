/**
 * Stale Tasks Webhook Handler
 *
 * Receives external alerts about stale tasks.
 * The webhook endpoint is auto-registered by the spec engine.
 */

import type { HookContext } from '@core/spec-engine/spec.types';

export default async function staleWebhookHandler(
  payload: Record<string, unknown>,
  ctx: HookContext,
): Promise<void> {
  const taskIds = payload.taskIds || [payload.taskId];
  ctx.logger.log(
    `Received stale webhook for tasks: ${JSON.stringify(taskIds)}`,
  );
  ctx.logger.log(`Stale since: ${payload.staleSince || 'unknown'}`);

  // Log to ErrorTracker for visibility
  await ctx.logError(
    `Stale task alert received for ${Array.isArray(taskIds) ? taskIds.length : 1} task(s)`,
    'spec-engine:tasks:stale-webhook',
    { taskIds, staleSince: payload.staleSince },
  );
}
