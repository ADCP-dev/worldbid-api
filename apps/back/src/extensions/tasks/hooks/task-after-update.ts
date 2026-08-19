/**
 * Task After Update Hook
 *
 * Fires after a task is updated. Side effects only (fire-and-forget).
 * Writes a row to the `task-activity` resource with action='updated' so the
 * audit log captures who changed the task and a human-readable description.
 *
 * The engine's `executeAfterHook` already swallows hook errors and logs them
 * via the SpecErrorReporter, so a failure here never breaks the PATCH
 * response. We still wrap the body in a try/catch that logs a warning — this
 * keeps the hook resilient even if `getRepository('task-activity')` throws
 * (e.g. resource not registered) and avoids a noisy double-report path.
 *
 * Introduced by change `tasks-v2-professional` (Slice 2).
 */

import type { HookContext } from '@core/spec-engine/spec.types';

interface TaskRow {
  id: number;
  title: string;
}

export default async function taskAfterUpdate(
  entity: Record<string, unknown>,
  ctx: HookContext,
): Promise<void> {
  const task = entity as unknown as TaskRow;

  const userId = ctx.user?.id ?? null;
  const description = `Task "${task.title}" updated`;

  try {
    const repo = ctx.getRepository('task-activity');
    await repo.save({
      action: 'updated',
      description,
      userId,
      taskId: task.id,
    });
    ctx.logger.log(
      `task-after-update: activity written for task ${task.id} by user ${userId ?? 'anon'}`,
    );
  } catch (err) {
    // Fire-and-forget: activity failures must not break the task update.
    ctx.logger.warn(
      `task-after-update: could not write activity for task ${task.id}: ${(err as Error).message}`,
    );
  }
}