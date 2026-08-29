/**
 * SpecSeedLoader — TDD tests for seed dedup + FK-dependency sort.
 *
 * Covers:
 *   - runSpecSeeds upserts seeds by explicit id and skips existing rows
 *   - runSpecSeeds dedups by all non-auto fields when no explicit id
 *   - runSpecSeeds sorts resources so referenced parents seed first
 *   - runSpecSeeds logs and continues on per-resource failure (never crashes boot)
 */

import { runSpecSeeds } from '@src/core/spec-engine/spec-seed-loader';
import type { LoadedSpec } from '@src/core/spec-engine/spec-loader';
import type {
  ResourceSpec,
  ExtensionSpec,
} from '@src/core/spec-engine/spec.types';

// ─── Mock helpers ────────────────────────────────────────────────────────────

interface MockRepo {
  findOne: jest.Mock;
  insert: jest.Mock;
}

function makeMockRepo(): MockRepo & { calls: Array<{ where: unknown }> } {
  const calls: Array<{ where: unknown }> = [];
  return {
    calls,
    findOne: jest.fn(async (opts: { where: unknown }) => {
      calls.push({ where: opts.where });
      return undefined;
    }),
    insert: jest.fn(async () => {}),
  };
}

function makeDataSource(repoMap: Record<string, MockRepo>): {
  getRepository: jest.Mock;
} {
  return {
    getRepository: jest.fn((name: string) => repoMap[name]),
  };
}

function makeResource(
  name: string,
  opts: Partial<ResourceSpec> = {},
): ResourceSpec {
  return {
    name,
    table: `ext_test_${name}`,
    fields: opts.fields ?? [],
    seeds: opts.seeds,
    ...opts,
  } as ResourceSpec;
}

function makeLoadedSpec(resources: ResourceSpec[]): LoadedSpec {
  return {
    spec: {
      name: 'test',
      version: '1.0.0',
      resources,
    } as ExtensionSpec,
    dir: '/tmp/test',
    specPath: '/tmp/test/test.spec.yaml',
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SpecSeedLoader — seed dedup + FK-dependency sort', () => {
  it('upserts seeds by explicit id and skips existing rows', async () => {
    const taskRepo = makeMockRepo();
    // Simulate that id=1 already exists
    taskRepo.findOne.mockImplementationOnce(async () => ({ id: 1 }));
    const ds = makeDataSource({ task: taskRepo });
    const task = makeResource('task', {
      seeds: [
        { id: 1, title: 'First' },
        { id: 2, title: 'Second' },
      ],
    });

    await runSpecSeeds([makeLoadedSpec([task])], ds as never);

    // id=1 exists → skipped; id=2 → inserted
    expect(taskRepo.insert).toHaveBeenCalledTimes(1);
    expect(taskRepo.insert).toHaveBeenCalledWith({ id: 2, title: 'Second' });
  });

  it('dedups by all non-auto fields when no explicit id', async () => {
    const commentRepo = makeMockRepo();
    // First lookup returns undefined (insert), second returns a row (skip)
    commentRepo.findOne.mockResolvedValueOnce(undefined);
    commentRepo.findOne.mockResolvedValueOnce({ id: 99 });
    const ds = makeDataSource({ 'task-comment': commentRepo });
    const comment = makeResource('task-comment', {
      seeds: [
        { content: 'First comment', taskId: 1 },
        { content: 'First comment', taskId: 1 }, // duplicate → skip
      ],
    });

    await runSpecSeeds([makeLoadedSpec([comment])], ds as never);

    // Only the first seed inserts; the second is skipped (matched by content+taskId)
    expect(commentRepo.insert).toHaveBeenCalledTimes(1);
  });

  it('sorts resources so referenced parents seed before children', async () => {
    const insertOrder: string[] = [];
    const taskRepo = makeMockRepo();
    taskRepo.insert.mockImplementation(async (seed: { title?: string }) => {
      insertOrder.push(`task:${seed.title}`);
    });
    const activityRepo = makeMockRepo();
    activityRepo.insert.mockImplementation(async (seed: { desc?: string }) => {
      insertOrder.push(`activity:${seed.desc}`);
    });

    const ds = makeDataSource({
      task: taskRepo,
      'task-activity': activityRepo,
    });

    // activity has a ref to task — even though activity is declared first,
    // it must be seeded AFTER task.
    const activity = makeResource('task-activity', {
      fields: [{ name: 'taskId', type: 'ref', ref: 'task' } as never],
      seeds: [{ desc: 'activity row', taskId: 1 }],
    });
    const task = makeResource('task', {
      seeds: [{ title: 'task row' }],
    });

    await runSpecSeeds([makeLoadedSpec([activity, task])], ds as never);

    expect(insertOrder).toEqual(['task:task row', 'activity:activity row']);
  });

  it('logs and continues when a resource fails (never crashes boot)', async () => {
    const brokenRepo = makeMockRepo();
    brokenRepo.findOne.mockRejectedValueOnce(new Error('DB down'));
    const goodRepo = makeMockRepo();

    const ds = makeDataSource({ broken: brokenRepo, good: goodRepo });
    const broken = makeResource('broken', { seeds: [{ id: 1 }] });
    const good = makeResource('good', { seeds: [{ id: 2 }] });

    // Should NOT throw — per-resource try/catch isolates failures.
    await expect(
      runSpecSeeds([makeLoadedSpec([broken, good])], ds as never),
    ).resolves.toBeUndefined();

    // The good resource still seeds despite the broken one failing.
    expect(goodRepo.insert).toHaveBeenCalledTimes(1);
  });

  it('skips resources with no seeds', async () => {
    const emptyRepo = makeMockRepo();
    const ds = makeDataSource({ empty: emptyRepo });
    const empty = makeResource('empty', { seeds: [] });

    await runSpecSeeds([makeLoadedSpec([empty])], ds as never);

    expect(emptyRepo.findOne).not.toHaveBeenCalled();
    expect(emptyRepo.insert).not.toHaveBeenCalled();
  });
});
