/**
 * Reorder Action Handler — `PATCH /tasks/reorder`
 *
 * Batch-updates task positions after a kanban drag-and-drop. The client sends
 * a list of `{ id, position }` pairs; each task's `position` column is
 * updated. Position is a field-level admin/manager concern (see
 * `task.spec.yaml` → `permissions.fields.position`), so the action's `auth`
 * is restricted to `[admin, manager]`.
 *
 * Loaded by `SpecEngineActionFactory`. Signature:
 *   (entityId: null, input: { items: Array<{id, position}> }, ctx)
 *     => Promise<{ success: true }>
 *
 * The action factory already type-checks `items` as `json` (must be an
 * object/array). We additionally validate that it is an array of objects with
 * numeric `id` + `position`; on a bad shape we abort with 400.
 *
 * Introduced by change `tasks-v2-professional` (Slice 3).
 */

import type { HookContext } from '@core/spec-engine/spec.types';

interface ReorderItem {
  id: number;
  position: number;
}

function isReorderItem(value: unknown): value is ReorderItem {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'number' &&
    Number.isFinite(v.id) &&
    typeof v.position === 'number' &&
    Number.isFinite(v.position)
  );
}

export default async function reorderHandler(
  _entityId: number | null,
  input: Record<string, unknown>,
  ctx: HookContext,
): Promise<{ success: true }> {
  const items = input.items;

  if (!Array.isArray(items)) {
    ctx.abort('Field "items" must be an array of { id, position }', 400);
  }

  if (!items.every(isReorderItem)) {
    ctx.abort(
      'Each item must be an object with numeric "id" and "position"',
      400,
    );
  }

  const taskRepo = ctx.getRepository('task');

  await ctx.transaction(async (txCtx) => {
    const txRepo = txCtx.getRepository('task');
    for (const item of items as ReorderItem[]) {
      await txRepo.update(item.id, { position: item.position });
    }
  });

  ctx.logger.log(`reorder: updated ${items.length} task positions`);
  return { success: true };
}