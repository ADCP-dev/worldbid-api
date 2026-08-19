/**
 * Task After Update Hook — TDD tests for change `tasks-v2-professional` Slice 2.
 *
 * Verifies the hook writes a `task-activity` row when a task is updated:
 *   - The activity row has action='updated'.
 *   - userId is populated from ctx.user.id (or null when no user).
 *   - taskId is populated from entity.id.
 *   - The description mentions the task title.
 *   - If the repository save fails, the hook logs a warning and does NOT
 *     throw (fire-and-forget).
 *
 * The hook receives (entity, ctx) — entity is the task AFTER the update.
 * ctx.user.id is the authenticated user. The hook writes via
 * ctx.getRepository('task-activity').save(...).
 */
import type { HookContext } from '@core/spec-engine/spec.types';

import taskAfterUpdate from '@ext/tasks/hooks/task-after-update';

// ─── Mock helpers ────────────────────────────────────────────────────────────

interface MockActivityRepo {
  save: jest.Mock;
}

interface MockTaskRepo {
  findOne: jest.Mock;
}

function makeMockCtx(opts: {
  activityRepo: MockActivityRepo;
  taskRepo?: MockTaskRepo;
  user?: { id: number; role: { name: string } } | null;
  saveThrows?: boolean;
}): HookContext {
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    fatal: jest.fn(),
    setContext: jest.fn(),
    localInstance: undefined,
  };

  if (opts.saveThrows) {
    opts.activityRepo.save = jest
      .fn()
      .mockRejectedValue(new Error('db connection lost'));
  }

  return {
    operation: 'update',
    resource: 'task',
    user:
      opts.user === undefined
        ? ({ id: 5, role: { name: 'user' } } as any)
        : (opts.user as any),
    getRepository: jest.fn((name: string) => {
      if (name === 'task-activity') return opts.activityRepo as any;
      if (name === 'task' && opts.taskRepo) return opts.taskRepo as any;
      throw new Error(`unexpected repo ${name}`);
    }),
    getService: jest.fn(() => ({})) as any,
    config: jest.fn(() => undefined),
    sendEmail: jest.fn().mockResolvedValue(undefined),
    logError: jest.fn().mockResolvedValue(undefined),
    logger: logger as any,
    trace: { add: jest.fn(), isActive: jest.fn().mockReturnValue(false) } as any,
    abort: jest.fn(() => {
      throw new Error('abort');
    }) as any,
    transaction: jest.fn(async <T>(fn: (tx: HookContext) => Promise<T>) =>
      fn({} as HookContext),
    ) as any,
  } as unknown as HookContext;
}

describe('task-after-update hook — Slice 2', () => {
  it('writes a task-activity row with action="updated"', async () => {
    const activityRepo: MockActivityRepo = { save: jest.fn().mockResolvedValue(undefined) };
    const ctx = makeMockCtx({ activityRepo });

    await taskAfterUpdate(
      { id: 42, title: 'Refactor auth module', status: 'in_progress' },
      ctx,
    );

    expect(activityRepo.save).toHaveBeenCalledTimes(1);
    const saved = activityRepo.save.mock.calls[0][0];
    expect(saved.action).toBe('updated');
  });

  it('populates userId from ctx.user.id', async () => {
    const activityRepo: MockActivityRepo = { save: jest.fn().mockResolvedValue(undefined) };
    const ctx = makeMockCtx({ activityRepo, user: { id: 7, role: { name: 'manager' } } });

    await taskAfterUpdate(
      { id: 42, title: 'Refactor auth module' },
      ctx,
    );

    const saved = activityRepo.save.mock.calls[0][0];
    expect(saved.userId).toBe(7);
  });

  it('populates taskId from entity.id', async () => {
    const activityRepo: MockActivityRepo = { save: jest.fn().mockResolvedValue(undefined) };
    const ctx = makeMockCtx({ activityRepo });

    await taskAfterUpdate(
      { id: 99, title: 'Write API documentation' },
      ctx,
    );

    const saved = activityRepo.save.mock.calls[0][0];
    expect(saved.taskId).toBe(99);
  });

  it('includes the task title in the description', async () => {
    const activityRepo: MockActivityRepo = { save: jest.fn().mockResolvedValue(undefined) };
    const ctx = makeMockCtx({ activityRepo });

    await taskAfterUpdate(
      { id: 42, title: 'Migrate to new S3 SDK' },
      ctx,
    );

    const saved = activityRepo.save.mock.calls[0][0];
    expect(saved.description).toContain('Migrate to new S3 SDK');
  });

  it('uses null for userId when ctx.user is null (anonymous/system)', async () => {
    const activityRepo: MockActivityRepo = { save: jest.fn().mockResolvedValue(undefined) };
    const ctx = makeMockCtx({ activityRepo, user: null });

    await taskAfterUpdate(
      { id: 42, title: 'System task' },
      ctx,
    );

    const saved = activityRepo.save.mock.calls[0][0];
    expect(saved.userId).toBeNull();
  });

  it('logs a warning and does NOT throw when the activity save fails', async () => {
    const activityRepo: MockActivityRepo = { save: jest.fn() };
    const ctx = makeMockCtx({ activityRepo, saveThrows: true });

    // Must NOT throw — after hooks are fire-and-forget.
    await expect(
      taskAfterUpdate(
        { id: 42, title: 'Refactor auth module' },
        ctx,
      ),
    ).resolves.toBeUndefined();
    expect((ctx.logger.warn as jest.Mock)).toHaveBeenCalled();
  });
});