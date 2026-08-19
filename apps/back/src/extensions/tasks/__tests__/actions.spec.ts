/**
 * Actions — TDD tests for change `tasks-v2-professional` Slice 3.
 *
 * Verifies the three custom action handlers (stats / reorder / bulk-status):
 *   - stats: returns the documented shape with correct counts from a mocked repo
 *   - reorder: updates each task position in a transaction
 *   - bulk-status: updates status for owned tasks + writes activity rows
 *   - bulk-status rowLevel: user role cannot update tasks they don't own
 *     (those ids are skipped, not 403-for-the-whole-batch)
 *
 * Handlers receive (entityId, input, ctx). `entityId` is null for bulk
 * actions. `input` is the parsed body. `ctx.getRepository('task')` returns a
 * mocked TypeORM repository + query builder.
 */
import type { HookContext } from '@core/spec-engine/spec.types';

import statsHandler from '@ext/tasks/handlers/stats-handler';
import reorderHandler from '@ext/tasks/handlers/reorder-handler';
import bulkStatusHandler from '@ext/tasks/handlers/bulk-status-handler';

// ─── Mock QueryBuilder (chainable) ───────────────────────────────────────────

interface QbConfig {
  rawRows?: unknown[];
  manyRows?: unknown[];
}

function makeQueryBuilder(cfg: QbConfig = {}) {
  const qb: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(cfg.rawRows ?? []),
    getMany: jest.fn().mockResolvedValue(cfg.manyRows ?? []),
  };
  return qb;
}

interface MockTaskRepo {
  createQueryBuilder: jest.Mock;
  update: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
}

interface MockActivityRepo {
  save: jest.Mock;
}

function makeMockTaskRepo(opts: {
  qbConfigs?: QbConfig[];
  update?: jest.Mock;
  findOne?: jest.Mock;
}): MockTaskRepo {
  const configs = opts.qbConfigs ?? [];
  let callIdx = 0;
  return {
    createQueryBuilder: jest.fn(() => {
      const cfg = configs[callIdx] ?? {};
      callIdx++;
      return makeQueryBuilder(cfg);
    }),
    update: opts.update ?? jest.fn().mockResolvedValue(undefined),
    findOne: opts.findOne ?? jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMockCtx(opts: {
  taskRepo: MockTaskRepo;
  activityRepo?: MockActivityRepo;
  user?: { id: number; role: { name: string } } | null;
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

  const activityRepo: MockActivityRepo =
    opts.activityRepo ?? { save: jest.fn().mockResolvedValue(undefined) };

  const abortMock = jest.fn((message: string, statusCode = 400): never => {
    const err = new Error(message) as Error & { statusCode: number };
    err.statusCode = statusCode;
    throw err;
  });

  const ctx = {
    operation: 'action',
    resource: 'task',
    user:
      opts.user === undefined
        ? ({ id: 5, role: { name: 'user' } } as any)
        : (opts.user as any),
    getRepository: jest.fn((name: string) => {
      if (name === 'task') return opts.taskRepo as any;
      if (name === 'task-activity') return activityRepo as any;
      throw new Error(`unexpected repo ${name}`);
    }),
    getService: jest.fn(() => ({})) as any,
    config: jest.fn(() => undefined),
    sendEmail: jest.fn().mockResolvedValue(undefined),
    logError: jest.fn().mockResolvedValue(undefined),
    logger: logger as any,
    trace: { add: jest.fn(), isActive: jest.fn().mockReturnValue(false) } as any,
    abort: abortMock as unknown as HookContext['abort'],
    transaction: jest.fn(async <T>(fn: (txCtx: HookContext) => Promise<T>) => {
      // In tests, the tx context shares the same repos (no real DB).
      return fn(ctx as unknown as HookContext);
    }) as any,
  } as unknown as HookContext;

  return ctx;
}

// ─── stats ───────────────────────────────────────────────────────────────────

describe('stats handler — Slice 3', () => {
  it('returns the documented shape with correct counts', async () => {
    // The handler issues 6 query builders in this order:
    // 0 byStatus, 1 byPriority, 2 byAssignee, 3 throughput, 4 upcoming, 5 overdue
    // byStatus/byPriority/byAssignee/throughput use getRawMany();
    // upcoming/overdue use getRawMany() too (aliased select).
    const taskRepo = makeMockTaskRepo({
      qbConfigs: [
        { rawRows: [{ status: 'pending', cnt: '3' }, { status: 'done', cnt: '2' }] },
        { rawRows: [{ priority: 'high', cnt: '1' }, { priority: 'urgent', cnt: '4' }] },
        {
          rawRows: [
            { assigneeId: 1, firstName: 'Ada', lastName: 'Lovelace', cnt: '5' },
          ],
        },
        { rawRows: [{ day: '2026-08-18', cnt: '2' }] },
        { rawRows: [{ id: 10, title: 'Upcoming task', dueDate: '2026-08-22' }] },
        { rawRows: [{ id: 11, title: 'Overdue task', dueDate: '2026-08-01' }] },
      ],
    });
    const ctx = makeMockCtx({ taskRepo, user: { id: 1, role: { name: 'admin' } } });

    const result = await statsHandler(null, {}, ctx);

    expect(result.byStatus).toEqual({
      pending: 3,
      in_progress: 0,
      review: 0,
      done: 2,
      blocked: 0,
    });
    expect(result.byPriority).toEqual({
      low: 0,
      medium: 0,
      high: 1,
      urgent: 4,
    });
    expect(result.byAssignee).toEqual([
      { id: 1, name: 'Ada Lovelace', count: 5 },
    ]);
    expect(result.throughput).toEqual([{ date: '2026-08-18', count: 2 }]);
    expect(result.upcoming).toEqual([
      { id: 10, title: 'Upcoming task', dueDate: '2026-08-22' },
    ]);
    expect(result.overdue).toEqual([
      { id: 11, title: 'Overdue task', dueDate: '2026-08-01' },
    ]);
  });

  it('returns zero counts (not 404) when the dataset is empty', async () => {
    const taskRepo = makeMockTaskRepo({ qbConfigs: [{}, {}, {}, {}, {}, {}] });
    const ctx = makeMockCtx({ taskRepo, user: { id: 1, role: { name: 'admin' } } });

    const result = await statsHandler(null, {}, ctx);

    expect(result.byStatus).toEqual({
      pending: 0,
      in_progress: 0,
      review: 0,
      done: 0,
      blocked: 0,
    });
    expect(result.byPriority).toEqual({
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    });
    expect(result.byAssignee).toEqual([]);
    expect(result.throughput).toEqual([]);
    expect(result.upcoming).toEqual([]);
    expect(result.overdue).toEqual([]);
  });
});

// ─── reorder ─────────────────────────────────────────────────────────────────

describe('reorder handler — Slice 3', () => {
  it('updates each task position inside a transaction', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const taskRepo = makeMockTaskRepo({ update });
    const ctx = makeMockCtx({
      taskRepo,
      user: { id: 1, role: { name: 'manager' } },
    });

    const result = await reorderHandler(
      null,
      { items: [{ id: 1, position: 0 }, { id: 2, position: 1 }] },
      ctx,
    );

    expect(result).toEqual({ success: true });
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(1, 1, { position: 0 });
    expect(update).toHaveBeenNthCalledWith(2, 2, { position: 1 });
    expect(ctx.transaction).toHaveBeenCalled();
  });

  it('aborts with 400 when items is not an array', async () => {
    const taskRepo = makeMockTaskRepo({});
    const ctx = makeMockCtx({
      taskRepo,
      user: { id: 1, role: { name: 'manager' } },
    });

    await expect(
      reorderHandler(null, { items: 'not-an-array' }, ctx),
    ).rejects.toThrow('Field "items" must be an array');
    expect(ctx.abort).toHaveBeenCalledWith(
      expect.stringContaining('must be an array'),
      400,
    );
  });
});

// ─── bulk-status ─────────────────────────────────────────────────────────────

describe('bulk-status handler — Slice 3', () => {
  it('updates status for owned tasks and writes activity rows', async () => {
    // user id=5 owns tasks 1 and 2.
    const findOne = jest
      .fn()
      .mockResolvedValueOnce({ id: 1, assigneeId: 5 })
      .mockResolvedValueOnce({ id: 2, assigneeId: 5 });
    const update = jest.fn().mockResolvedValue(undefined);
    const taskRepo = makeMockTaskRepo({ findOne, update });
    const activityRepo = { save: jest.fn().mockResolvedValue(undefined) };
    const ctx = makeMockCtx({
      taskRepo,
      activityRepo,
      user: { id: 5, role: { name: 'user' } },
    });

    const result = await bulkStatusHandler(
      null,
      { ids: [1, 2], status: 'done' },
      ctx,
    );

    expect(result).toEqual({ updated: 2, skipped: 0 });
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(1, 1, { status: 'done' });
    expect(update).toHaveBeenNthCalledWith(2, 2, { status: 'done' });
    expect(activityRepo.save).toHaveBeenCalledTimes(2);
  });

  it('respects rowLevel: user role skips tasks they do not own', async () => {
    // user id=5 owns task 1; task 2 is owned by user 9.
    const findOne = jest
      .fn()
      .mockResolvedValueOnce({ id: 1, assigneeId: 5 })
      .mockResolvedValueOnce({ id: 2, assigneeId: 9 });
    const update = jest.fn().mockResolvedValue(undefined);
    const taskRepo = makeMockTaskRepo({ findOne, update });
    const activityRepo = { save: jest.fn().mockResolvedValue(undefined) };
    const ctx = makeMockCtx({
      taskRepo,
      activityRepo,
      user: { id: 5, role: { name: 'user' } },
    });

    const result = await bulkStatusHandler(
      null,
      { ids: [1, 2], status: 'done' },
      ctx,
    );

    expect(result).toEqual({ updated: 1, skipped: 1 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(1, { status: 'done' });
    expect(activityRepo.save).toHaveBeenCalledTimes(1);
  });

  it('admin bypasses rowLevel and updates all tasks', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValueOnce({ id: 1, assigneeId: 5 })
      .mockResolvedValueOnce({ id: 2, assigneeId: 9 });
    const update = jest.fn().mockResolvedValue(undefined);
    const taskRepo = makeMockTaskRepo({ findOne, update });
    const activityRepo = { save: jest.fn().mockResolvedValue(undefined) };
    const ctx = makeMockCtx({
      taskRepo,
      activityRepo,
      user: { id: 1, role: { name: 'admin' } },
    });

    const result = await bulkStatusHandler(
      null,
      { ids: [1, 2], status: 'in_progress' },
      ctx,
    );

    expect(result).toEqual({ updated: 2, skipped: 0 });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('counts a missing task as skipped (not 404)', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(null) // task 1 missing
      .mockResolvedValueOnce({ id: 2, assigneeId: 5 });
    const update = jest.fn().mockResolvedValue(undefined);
    const taskRepo = makeMockTaskRepo({ findOne, update });
    const ctx = makeMockCtx({
      taskRepo,
      user: { id: 5, role: { name: 'user' } },
    });

    const result = await bulkStatusHandler(
      null,
      { ids: [1, 2], status: 'done' },
      ctx,
    );

    expect(result).toEqual({ updated: 1, skipped: 1 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(2, { status: 'done' });
  });

  it('aborts with 400 when status is not a valid enum', async () => {
    const taskRepo = makeMockTaskRepo({});
    const ctx = makeMockCtx({
      taskRepo,
      user: { id: 5, role: { name: 'user' } },
    });

    await expect(
      bulkStatusHandler(null, { ids: [1], status: 'archived' }, ctx),
    ).rejects.toThrow('Field "status" must be one of');
  });
});