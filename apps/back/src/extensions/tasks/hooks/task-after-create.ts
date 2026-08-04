/**
 * Task After Create Hook
 *
 * Fires after a task is created. Side effects only (fire-and-forget).
 * Could sync to external systems, update counters, etc.
 */

import type { HookContext } from '@core/spec-engine/spec.types';

export default async function taskAfterCreate(
  entity: Record<string, unknown>,
  ctx: HookContext,
): Promise<void> {
  ctx.logger.log(`Task created: id=${entity.id}, title=${entity.title}`);

  // Example: log to error tracker for audit trail
  // (not actually an error, just using the infrastructure)
  // await ctx.logError(`Task created: ${entity.id}`, 'spec-engine:task:audit', { entity });
}
