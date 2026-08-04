/**
 * Task After Update Hook
 *
 * Fires after a task is updated. Side effects only (fire-and-forget).
 * Used by the canonical tasks extension to log activity and surface
 * status changes via the notification system.
 *
 * Introduced by change `spec-engine-v2-frontend-and-loader` (Slice 7) as part
 * of the canonical example redesign. Implementation is intentionally minimal:
 * it traces the update event and would, in a real deployment, write an entry
 * to the `task-activity` resource and trigger the `notify-status-change`
 * notification when the status field changes.
 */

import type { HookContext } from '@core/spec-engine/spec.types';

export default async function taskAfterUpdate(
  entity: Record<string, unknown>,
  ctx: HookContext,
): Promise<void> {
  ctx.logger.log(`Task updated: id=${entity.id}, title=${entity.title}`);

  // TODO: in a real deployment, compare the previous vs new values (available
  // via ctx.trace or a diff passed in by the engine) and write a `task-activity`
  // row with action='updated' + a description of what changed. The
  // notification dispatcher handles `notify-status-change` based on the spec's
  // `when: 'changed.status != null'` predicate.
}
