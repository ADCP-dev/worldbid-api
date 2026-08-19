/**
 * Bulk Status Action Handler — `PATCH /tasks/bulk-status`
 *
 * Updates the `status` of many tasks in one call. Role-level auth is
 * `[admin, user, manager]` (matches `task.update` permissions), but the
 * handler additionally enforces rowLevel per task: `user` and `manager`
 * roles can only update tasks where `assigneeId === ctx.user.id`. Admin has
 * no rowLevel entry in the spec → bypasses the check.
 *
 * Loaded by `SpecEngineActionFactory`. Signature:
 *   (entityId: null, input: { ids: number[], status: TaskStatus }, ctx)
 *     => Promise<{ updated: number, skipped: number }>
 *
 * The action factory type-checks `ids` as `json` and `status` as `enum`
 * (string). We re-validate the array shape + status enum here and abort with
 * 400 on a bad shape. RowLevel violations for a single id are counted as
 * `skipped` (not 403 for the whole batch) so the client can retry the
 * rejected subset. A missing task is also `skipped`.
 *
 * Introduced by change `tasks-v2-professional` (Slice 3).
 */

import type { HookContext } from '@core/spec-engine/spec.types';

type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done' | 'blocked';

const STATUS_ENUM: TaskStatus[] = [
  'pending',
  'in_progress',
  'review',
  'done',
  'blocked',
];

const ROW_LEVEL_ROLES = new Set(['user', 'manager']);

function isStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (STATUS_ENUM as string[]).includes(value);
}

interface TaskRow {
  id: number;
  assigneeId: number | null;
}

export default async function bulkStatusHandler(
  _entityId: number | null,
  input: Record<string, unknown>,
  ctx: HookContext,
): Promise<{ updated: number; skipped: number }> {
  const ids = input.ids;
  const status = input.status;

  if (!Array.isArray(ids) || ids.length === 0) {
    ctx.abort('Field "ids" must be a non-empty array', 400);
  }
  if (!ids.every((id) => typeof id === 'number' && Number.isFinite(id))) {
    ctx.abort('Field "ids" must be an array of numbers', 400);
  }
  if (!isStatus(status)) {
    ctx.abort(
      `Field "status" must be one of: ${STATUS_ENUM.join(', ')}`,
      400,
    );
  }

  const userId = ctx.user?.id ?? null;
  const roleName = ctx.user?.role?.name ?? '';
  const enforceRowLevel = ROW_LEVEL_ROLES.has(roleName);

  let updated = 0;
  let skipped = 0;

  await ctx.transaction(async (txCtx) => {
    const txTaskRepo = txCtx.getRepository('task');
    const txActivityRepo = txCtx.getRepository('task-activity');

    for (const id of ids as number[]) {
      const task = (await txTaskRepo.findOne({
        where: { id },
      })) as TaskRow | null;

      if (!task) {
        skipped++;
        continue;
      }

      if (enforceRowLevel) {
        if (task.assigneeId !== userId) {
          skipped++;
          continue;
        }
      }

      await txTaskRepo.update(id, { status });

      // Best-effort activity row — fire-and-forget inside the tx.
      try {
        await txActivityRepo.save({
          action: 'updated',
          description: `Task #${id} status → ${status} (bulk)`,
          userId,
          taskId: id,
        });
      } catch (err) {
        ctx.logger.warn(
          `bulk-status: could not write activity for task ${id}: ${(err as Error).message}`,
        );
      }

      updated++;
    }
  });

  ctx.logger.log(
    `bulk-status: updated=${updated} skipped=${skipped} status=${status} by user=${userId ?? 'anon'}`,
  );
  return { updated, skipped };
}