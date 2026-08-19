/**
 * Task Note After Create Hook — TDD tests for change `tasks-v2-professional` Slice 1.
 *
 * Verifies the hook notifies the task's assignee when a note is created:
 *   - When the parent task has an assigneeId, sendEmail is called.
 *   - When the parent task has no assignee (assigneeId null), sendEmail is NOT called.
 *   - If sendEmail throws, the hook logs a warning and does NOT throw (fire-and-forget).
 *
 * The hook reads the parent task via ctx.getRepository('task') to find the
 * assigneeId + title, then calls ctx.sendEmail.
 */
import type { HookContext } from '@core/spec-engine/spec.types';

// Import the hook under test (default export function).
// RED: the file does not exist yet → import fails → tests fail.
import taskNoteAfterCreate from '@ext/tasks/hooks/task-note-after-create';

// ─── Mock helpers ────────────────────────────────────────────────────────────

interface MockRepo {
  findOne: jest.Mock;
}

function makeMockTaskRepo(task: Record<string, unknown> | null): MockRepo {
  return {
    findOne: jest.fn().mockResolvedValue(task),
  };
}

function makeMockCtx(opts: {
  taskRepo: MockRepo;
  sendEmail?: jest.Mock;
  sendEmailThrows?: boolean;
  notificationEmail?: string;
}): HookContext {
  const sendEmailMock =
    opts.sendEmail ??
    (opts.sendEmailThrows
      ? jest.fn().mockRejectedValue(new Error('mailer down'))
      : jest.fn().mockResolvedValue(undefined));

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

  return {
    operation: 'create',
    resource: 'task-note',
    user: { id: 5, role: { name: 'user' } } as any,
    getRepository: jest.fn((name: string) => {
      if (name === 'task') return opts.taskRepo as any;
      throw new Error(`unexpected repo ${name}`);
    }),
    getService: jest.fn(() => ({})) as any,
    config: jest.fn((key: string) => {
      if (key === 'app.notificationEmail') return opts.notificationEmail ?? 'team@example.com';
      return undefined;
    }),
    sendEmail: sendEmailMock,
    logError: jest.fn().mockResolvedValue(undefined),
    logger: logger as any,
    trace: { add: jest.fn(), isActive: jest.fn().mockReturnValue(false) } as any,
    abort: jest.fn(() => {
      throw new Error('abort');
    }) as any,
    transaction: jest.fn(async <T>(fn: (tx: HookContext) => Promise<T>) => fn({} as HookContext)) as any,
  } as unknown as HookContext;
}

describe('task-note-after-create hook — Slice 1', () => {
  it('notifies the assignee when the parent task has an assigneeId', async () => {
    const taskRepo = makeMockTaskRepo({
      id: 7,
      title: 'Refactor auth module',
      assigneeId: 12,
    });
    const sendEmail = jest.fn().mockResolvedValue(undefined);
    const ctx = makeMockCtx({ taskRepo, sendEmail });

    await taskNoteAfterCreate(
      { id: 99, content: 'Looks good', authorId: 5, taskId: 7 },
      ctx,
    );

    expect(taskRepo.findOne).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = sendEmail.mock.calls[0][0];
    expect(call.subject).toContain('Refactor auth module');
    expect(call.text).toContain('Looks good');
  });

  it('does NOT send email when the parent task has no assignee (assigneeId null)', async () => {
    const taskRepo = makeMockTaskRepo({
      id: 8,
      title: 'Unassigned task',
      assigneeId: null,
    });
    const sendEmail = jest.fn().mockResolvedValue(undefined);
    const ctx = makeMockCtx({ taskRepo, sendEmail });

    await taskNoteAfterCreate(
      { id: 100, content: 'A note', authorId: 5, taskId: 8 },
      ctx,
    );

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does NOT send email when the parent task is not found', async () => {
    const taskRepo = makeMockTaskRepo(null);
    const sendEmail = jest.fn().mockResolvedValue(undefined);
    const ctx = makeMockCtx({ taskRepo, sendEmail });

    await taskNoteAfterCreate(
      { id: 101, content: 'Orphan note', authorId: 5, taskId: 999 },
      ctx,
    );

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('logs a warning and does NOT throw when sendEmail fails', async () => {
    const taskRepo = makeMockTaskRepo({
      id: 9,
      title: 'Task with mailer down',
      assigneeId: 20,
    });
    const sendEmail = jest.fn().mockRejectedValue(new Error('mailer down'));
    const ctx = makeMockCtx({ taskRepo, sendEmail });

    // Must NOT throw — after hooks are fire-and-forget at the hook level too.
    await expect(
      taskNoteAfterCreate(
        { id: 102, content: 'Note', authorId: 5, taskId: 9 },
        ctx,
      ),
    ).resolves.toBeUndefined();
    expect((ctx.logger.warn as jest.Mock)).toHaveBeenCalled();
  });
});