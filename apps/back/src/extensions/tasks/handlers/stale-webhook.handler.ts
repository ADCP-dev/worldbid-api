/**
 * Stale Tasks Webhook Handler
 *
 * Receives external alerts about stale tasks.
 * The webhook endpoint is auto-registered by the spec engine.
 */

import type { HookContext } from '@core/spec-engine/spec.types';

export default async function staleWebhookHandler(
  payload: Record<string, unknown>,
): Promise<void> {
  // In the full implementation, this would:
  // 1. Look up tasks by ID from payload
  // 2. Update their status or add metadata flag
  // 3. Notify assignees

  // For the spike, just log the receipt
  const taskIds = payload.taskIds || [payload.taskId];
  const logger = console; // The webhook factory provides a minimal context
  logger.log(`[stale-webhook] Received alert for tasks: ${JSON.stringify(taskIds)}`);
  console.log(`[stale-webhook] Stale since: ${payload.staleSince || 'unknown'}`);
}