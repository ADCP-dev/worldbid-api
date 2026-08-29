/**
 * DbBranchManager — TDD tests for change `agent-native-prd04-db-branching`.
 *
 * Covers (REQ-01..REQ-08 from spec):
 *   - createBranch: schema creation, structure+data copy, tracking row, DbBranch return
 *   - copySchemaStructure: CREATE TABLE LIKE, FK drop+recreate, sequences+setval
 *   - copySchemaData: topological order, explicit columns, INSERT SELECT
 *   - topologicalSort: parents first, cycle fallback
 *   - runInBranch: temporary DataSource with branch schema, fn result, destroy on finally
 *   - mergeBranch: identify new migrations, re-apply against public, count verify, drop+update
 *   - discardBranch: drop schema cascade, update status
 *   - listBranches: select all, ordered by created_at desc
 *   - cleanupStale: select stale, drop+discard each, return count
 *
 * Mock strategy: DataSource.query is a jest.fn() routed through a SQL matcher.
 * runInBranch uses a mocked DataSource constructor (vi.mock typeorm) so no real
 * connection is opened.
 */
import { vi } from 'vitest';

// Mock typeorm DataSource constructor so runInBranch's `new DataSource` returns a stub.
// vi.mock is hoisted to the top of the file by Vitest, so the factory cannot
// reference outer variables. We define the mock implementation inside the
// factory and expose it on a module-level holder so tests can inspect calls.
export const __mockDataSourceInstances: Array<{
  options: { schema?: string };
  initialize: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('typeorm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('typeorm')>();
  // A function that works with `new` — returns an object instance.
  function MockDataSourceConstructor(
    this: unknown,
    options: { schema?: string },
  ) {
    const instance = {
      options,
      schema: options?.schema,
      initialize: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    __mockDataSourceInstances.push(instance);
    return instance;
  }
  // Preserve static members from the real DataSource (if any used by type checks).
  Object.assign(MockDataSourceConstructor, actual.DataSource);
  return {
    ...actual,
    DataSource: MockDataSourceConstructor as unknown as typeof DataSource,
  };
});

import { DbBranchManager } from '@src/core/spec-engine/db-branch-manager';
import type { DbBranch } from '@src/core/spec-engine/db-branch-manager';

// ─── Mock DataSource helpers ─────────────────────────────────────────────────
//
// `query` routes SQL through a queue of handlers. A handler matching by SQL
// substring is consumed (shifted) on first match, so repeated identical queries
// (e.g. two `SELECT count(*)`) can return different results in sequence.

interface QueryHandler {
  sql: string;
  params?: unknown[];
  result: unknown;
}

function makeMockDataSource(handlers: QueryHandler[] = []) {
  const queue = [...handlers];
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    for (let i = 0; i < queue.length; i++) {
      const hdl = queue[i];
      if (
        sql.includes(hdl.sql) &&
        (!hdl.params || JSON.stringify(params) === JSON.stringify(hdl.params))
      ) {
        queue.splice(i, 1);
        return hdl.result;
      }
    }
    return [];
  });
  return {
    query,
    calls,
    options: { type: 'postgres', url: 'postgres://test' },
    destroy: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
  };
}

// Helper: build a handler that matches by SQL substring.
function h(sql: string, result: unknown, params?: unknown[]): QueryHandler {
  return { sql, result, params };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DbBranchManager — createBranch (REQ-01)', () => {
  it('creates schema, copies structure+data, inserts tracking row, returns DbBranch', async () => {
    const ds = makeMockDataSource([
      // copySchemaStructure: tables
      h('information_schema.tables', [{ table_name: 'users' }]),
      // CREATE TABLE LIKE (no result)
      // FKs in target schema (none)
      h("con.contype = 'f'", []),
      // original FKs in source (none)
      // sequences
      h('information_schema.sequences', []),
      // copySchemaData: tables
      h('information_schema.tables', [{ table_name: 'users' }]),
      // topologicalSort deps for users
      h("tc.constraint_type = 'FOREIGN KEY'", []),
      // columns for users
      h('information_schema.columns', [
        { column_name: 'id' },
        { column_name: 'name' },
      ]),
    ]);

    const manager = new DbBranchManager(ds as never);
    const branch = await manager.createBranch({
      name: 'test-001',
      copyData: true,
    });

    expect(branch.name).toBe('test-001');
    expect(branch.schema).toBe('branch_test-001');
    expect(branch.status).toBe('active');
    expect(branch.parentSchema).toBe('public');
    expect(branch.copyData).toBe(true);
    expect(branch.createdBy).toBe('manual');

    // CREATE SCHEMA issued
    expect(
      ds.calls.some(
        (c) =>
          c.sql.includes('CREATE SCHEMA') && c.sql.includes('branch_test-001'),
      ),
    ).toBe(true);
    // Tracking INSERT into public._db_branches
    expect(
      ds.calls.some((c) => c.sql.includes('INSERT INTO public._db_branches')),
    ).toBe(true);
  });

  it('generates a random branch name when name is omitted', async () => {
    const ds = makeMockDataSource([
      h('information_schema.tables', []),
      h('information_schema.sequences', []),
    ]);
    const manager = new DbBranchManager(ds as never);
    const branch = await manager.createBranch({ copyData: false });

    expect(branch.name).toMatch(/^branch_[0-9a-f]{8}$/);
    expect(branch.schema).toBe(branch.name);
  });

  it('does not double-prefix branch_ when name already starts with branch_', async () => {
    const ds = makeMockDataSource([
      h('information_schema.tables', []),
      h('information_schema.sequences', []),
    ]);
    const manager = new DbBranchManager(ds as never);
    const branch = await manager.createBranch({
      name: 'branch_custom',
      copyData: false,
    });

    expect(branch.schema).toBe('branch_custom');
  });

  it('respects custom parentSchema', async () => {
    const ds = makeMockDataSource([
      h('information_schema.tables', []),
      h('information_schema.sequences', []),
    ]);
    const manager = new DbBranchManager(ds as never);
    const branch = await manager.createBranch({
      name: 'x',
      parentSchema: 'staging',
      copyData: false,
    });

    expect(branch.parentSchema).toBe('staging');
  });

  it('skips copySchemaData when copyData is false', async () => {
    const ds = makeMockDataSource([
      h('information_schema.tables', []),
      h('information_schema.sequences', []),
    ]);
    const manager = new DbBranchManager(ds as never);
    await manager.createBranch({ name: 'x', copyData: false });

    // No INSERT INTO "branch_x" ... SELECT should be issued (data copy skipped)
    expect(
      ds.calls.some(
        (c) =>
          c.sql.includes('INSERT INTO "branch_') && c.sql.includes('SELECT'),
      ),
    ).toBe(false);
  });
});

describe('DbBranchManager — copySchemaStructure (REQ-02)', () => {
  it('creates each table with LIKE INCLUDING ALL', async () => {
    const ds = makeMockDataSource([
      h('information_schema.tables', [
        { table_name: 'users' },
        { table_name: 'posts' },
      ]),
      // FKs in target (none returned)
      h("con.contype = 'f'", []),
      // sequences
      h('information_schema.sequences', []),
    ]);
    const manager = new DbBranchManager(ds as never);
    await manager.createBranch({ name: 's', copyData: false });

    const createStmts = ds.calls.filter(
      (c) => c.sql.includes('CREATE TABLE') && c.sql.includes('INCLUDING ALL'),
    );
    expect(createStmts.length).toBe(2);
    expect(createStmts[0].sql).toContain('"branch_s"."users"');
    expect(createStmts[1].sql).toContain('"branch_s"."posts"');
  });

  it('drops copied FKs and recreates them pointing to target schema', async () => {
    const ds = makeMockDataSource([
      h('information_schema.tables', [{ table_name: 'posts' }]),
      // original FKs in source (to be recreated) — matched by the "AND cls.relname"
      // clause that only appears in the source-FK query, not the target-FK query.
      h('AND cls.relname = $2', [
        {
          conname: 'fk_posts_user',
          def: 'FOREIGN KEY ("userId") REFERENCES "public"."users" (id)',
        },
      ]),
      // FKs copied into target (to be dropped) — generic match.
      h("con.contype = 'f'", [{ conname: 'fk_posts_user' }]),
      h('information_schema.sequences', []),
    ]);
    const manager = new DbBranchManager(ds as never);
    await manager.createBranch({ name: 'fk', copyData: false });

    // DROP CONSTRAINT for copied FK
    expect(
      ds.calls.some(
        (c) =>
          c.sql.includes('DROP CONSTRAINT') && c.sql.includes('fk_posts_user'),
      ),
    ).toBe(true);
    // ADD CONSTRAINT with replaced schema
    const addStmt = ds.calls.find(
      (c) =>
        c.sql.includes('ADD CONSTRAINT') && c.sql.includes('fk_posts_user'),
    );
    expect(addStmt).toBeDefined();
    expect(addStmt!.sql).toContain('"branch_fk"."users"');
    expect(addStmt!.sql).not.toContain('"public"."users"');
  });

  it('copies sequences and syncs setval to source last_value', async () => {
    const ds = makeMockDataSource([
      h('information_schema.tables', []),
      h('information_schema.sequences', [{ sequence_name: 'users_id_seq' }]),
      h('last_value', [{ last_value: 42 }]),
    ]);
    const manager = new DbBranchManager(ds as never);
    await manager.createBranch({ name: 'seq', copyData: false });

    expect(
      ds.calls.some(
        (c) =>
          c.sql.includes('CREATE SEQUENCE') && c.sql.includes('users_id_seq'),
      ),
    ).toBe(true);
    const setval = ds.calls.find((c) => c.sql.includes('setval'));
    expect(setval).toBeDefined();
    expect(setval!.params).toEqual([42]);
  });
});

describe('DbBranchManager — copySchemaData (REQ-03)', () => {
  it('inserts data in topological order with explicit columns', async () => {
    // copySchemaStructure runs first (tables, FKs, sequences), then copySchemaData
    // queries tables again + topological deps + columns per table.
    // Handlers are consumed in order, so duplicates are listed explicitly.
    const ds = makeMockDataSource([
      // structure: tables
      h('information_schema.tables', [
        { table_name: 'users' },
        { table_name: 'posts' },
      ]),
      // structure: FKs in target (none)
      h("con.contype = 'f'", []),
      // structure: FKs in source (none — the AND variant)
      h("con.contype = 'f' AND", []),
      // structure: sequences (none)
      h('information_schema.sequences', []),
      // data: tables again
      h('information_schema.tables', [
        { table_name: 'users' },
        { table_name: 'posts' },
      ]),
      // topologicalSort: posts depends on users (consumed when posts is checked)
      h("tc.constraint_type = 'FOREIGN KEY'", [{ dep_table: 'users' }]),
      // topologicalSort: users has no deps
      h("tc.constraint_type = 'FOREIGN KEY'", []),
      // columns for users
      h('information_schema.columns', [
        { column_name: 'id' },
        { column_name: 'name' },
      ]),
      // columns for posts
      h('information_schema.columns', [
        { column_name: 'id' },
        { column_name: 'title' },
      ]),
    ]);
    const manager = new DbBranchManager(ds as never);
    await manager.createBranch({ name: 'd', copyData: true });

    const inserts = ds.calls.filter(
      (c) =>
        c.sql.includes('INSERT INTO "branch_d"') && c.sql.includes('SELECT'),
    );
    expect(inserts.length).toBeGreaterThan(0);
    // Each insert uses explicit column list
    expect(inserts[0].sql).toMatch(/"id", "name"/);
  });
});

describe('DbBranchManager — topologicalSort (REQ-03)', () => {
  it('places tables without FKs first, dependent tables after', async () => {
    // Directly test the private method via bracket access (common test pattern).
    // topologicalSort queries deps once per table per pass. With 2 tables:
    //   pass 1: posts checked first → has dep on users (not processed) → skip;
    //           users checked → no deps → added. progressed=true.
    //   pass 2: posts checked → dep users is processed → added.
    // So posts gets 2 dep queries, users gets 1. Order handlers accordingly.
    const ds = makeMockDataSource([
      // posts deps (first check): depends on users
      h("tc.constraint_type = 'FOREIGN KEY'", [{ dep_table: 'users' }]),
      // users deps (no deps)
      h("tc.constraint_type = 'FOREIGN KEY'", []),
      // posts deps (second check, after users processed): still depends on users
      // but now users IS in result → posts gets added.
      h("tc.constraint_type = 'FOREIGN KEY'", [{ dep_table: 'users' }]),
    ]);
    const manager = new DbBranchManager(ds as never);
    const sorted = await (
      manager as unknown as {
        topologicalSort: (t: string[], s: string) => Promise<string[]>;
      }
    ).topologicalSort(['posts', 'users'], 'public');

    // users (no deps) should come before posts
    expect(sorted.indexOf('users')).toBeLessThan(sorted.indexOf('posts'));
  });

  it('falls back to remaining unordered tables when a cycle is detected', async () => {
    // a→b and b→a cycle: every table has an unprocessed dep, so no progress → all dumped.
    const ds = makeMockDataSource([
      // Both a and b report a dep on the other
      h("tc.constraint_type = 'FOREIGN KEY'", [{ dep_table: 'b' }]),
    ]);
    const manager = new DbBranchManager(ds as never);
    const sorted = await (
      manager as unknown as {
        topologicalSort: (t: string[], s: string) => Promise<string[]>;
      }
    ).topologicalSort(['a', 'b'], 'public');

    // Cycle → both included (no infinite loop), order not guaranteed
    expect(sorted).toContain('a');
    expect(sorted).toContain('b');
  });
});

describe('DbBranchManager — runInBranch (REQ-04)', () => {
  it('creates a temporary DataSource with branch schema, runs fn, returns result', async () => {
    const ds = makeMockDataSource([]);
    const manager = new DbBranchManager(ds as never);
    const branch: DbBranch = {
      name: 'rb',
      schema: 'branch_rb',
      createdAt: new Date().toISOString(),
      createdBy: 'manual',
      status: 'active',
      parentSchema: 'public',
      copyData: false,
    };

    const result = await manager.runInBranch(branch, async (bds) => {
      // The stubbed DataSource exposes .schema
      expect((bds as unknown as { schema: string }).schema).toBe('branch_rb');
      return 'done';
    });

    expect(result).toBe('done');
    // DataSource constructor was called with branch schema — check the last
    // pushed instance has the branch schema.
    const lastInst = __mockDataSourceInstances.at(-1);
    expect(lastInst).toBeDefined();
    expect(lastInst!.options.schema).toBe('branch_rb');
  });

  it('destroys the temporary DataSource even if fn throws', async () => {
    const ds = makeMockDataSource([]);
    const manager = new DbBranchManager(ds as never);
    const branch: DbBranch = {
      name: 'rb2',
      schema: 'branch_rb2',
      createdAt: new Date().toISOString(),
      createdBy: 'manual',
      status: 'active',
      parentSchema: 'public',
      copyData: false,
    };

    await expect(
      manager.runInBranch(branch, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // The last constructed mock DataSource's destroy should have been called.
    const lastInst = __mockDataSourceInstances.at(-1);
    expect(lastInst).toBeDefined();
    expect(lastInst!.destroy).toHaveBeenCalled();
  });
});

describe('DbBranchManager — mergeBranch (REQ-05)', () => {
  it('re-applies new migrations against public, verifies count, drops schema, marks merged', async () => {
    const ds = makeMockDataSource([
      // branch migrations: one new
      h('typeorm_migrations', [{ timestamp: 1700000000000, name: 'AddFoo' }]),
      // beforeCount
      h('SELECT count(*)::int AS count FROM public.typeorm_migrations', [
        { count: 5 },
      ]),
      // afterCount (5 + 1 = 6)
      h('SELECT count(*)::int AS count FROM public.typeorm_migrations', [
        { count: 6 },
      ]),
    ]);
    const manager = new DbBranchManager(ds as never);
    // Stub the private migration runner so we don't touch the filesystem.
    (
      manager as unknown as { runMigrationAgainstPublic: jest.Mock }
    ).runMigrationAgainstPublic = jest.fn().mockResolvedValue(undefined);

    const branch: DbBranch = {
      name: 'm',
      schema: 'branch_m',
      createdAt: new Date().toISOString(),
      createdBy: 'manual',
      status: 'active',
      parentSchema: 'public',
      copyData: false,
    };
    await manager.mergeBranch(branch);

    const runMock = (
      manager as unknown as { runMigrationAgainstPublic: jest.Mock }
    ).runMigrationAgainstPublic;
    expect(runMock).toHaveBeenCalledWith('AddFoo');
    expect(
      ds.calls.some(
        (c) => c.sql.includes('DROP SCHEMA') && c.sql.includes('branch_m'),
      ),
    ).toBe(true);
    expect(ds.calls.some((c) => c.sql.includes("status = 'merged'"))).toBe(
      true,
    );
  });

  it('throws when migration count does not match after re-apply', async () => {
    const ds = makeMockDataSource([
      h('typeorm_migrations', [{ timestamp: 1700000000000, name: 'AddFoo' }]),
      h('SELECT count(*)::int AS count FROM public.typeorm_migrations', [
        { count: 5 },
      ]),
      // afterCount wrong: 7 instead of 6
      h('SELECT count(*)::int AS count FROM public.typeorm_migrations', [
        { count: 7 },
      ]),
    ]);
    const manager = new DbBranchManager(ds as never);
    (
      manager as unknown as { runMigrationAgainstPublic: jest.Mock }
    ).runMigrationAgainstPublic = jest.fn().mockResolvedValue(undefined);

    const branch: DbBranch = {
      name: 'm2',
      schema: 'branch_m2',
      createdAt: new Date().toISOString(),
      createdBy: 'manual',
      status: 'active',
      parentSchema: 'public',
      copyData: false,
    };
    await expect(manager.mergeBranch(branch)).rejects.toThrow(
      /count mismatch/i,
    );
  });
});

describe('DbBranchManager — discardBranch (REQ-06)', () => {
  it('drops schema cascade and marks branch discarded', async () => {
    const ds = makeMockDataSource([]);
    const manager = new DbBranchManager(ds as never);
    const branch: DbBranch = {
      name: 'dc',
      schema: 'branch_dc',
      createdAt: new Date().toISOString(),
      createdBy: 'manual',
      status: 'active',
      parentSchema: 'public',
      copyData: false,
    };
    await manager.discardBranch(branch);

    expect(
      ds.calls.some(
        (c) =>
          c.sql.includes('DROP SCHEMA') &&
          c.sql.includes('branch_dc') &&
          c.sql.includes('CASCADE'),
      ),
    ).toBe(true);
    expect(ds.calls.some((c) => c.sql.includes("status = 'discarded'"))).toBe(
      true,
    );
  });
});

describe('DbBranchManager — listBranches (REQ-07)', () => {
  it('returns branches ordered by created_at desc', async () => {
    const rows = [
      {
        name: 'b2',
        schema: 'branch_b2',
        parent_schema: 'public',
        status: 'active',
        copy_data: true,
        created_by: 'agent1',
        created_at: new Date('2026-08-20').toISOString(),
      },
      {
        name: 'b1',
        schema: 'branch_b1',
        parent_schema: 'public',
        status: 'merged',
        copy_data: false,
        created_by: 'manual',
        created_at: new Date('2026-08-19').toISOString(),
      },
    ];
    const ds = makeMockDataSource([h('SELECT', rows)]);
    const manager = new DbBranchManager(ds as never);
    const branches = await manager.listBranches();

    expect(branches).toHaveLength(2);
    expect(branches[0].name).toBe('b2');
    expect(branches[0].status).toBe('active');
    expect(branches[1].status).toBe('merged');
    // Query ordered by created_at DESC
    expect(ds.calls[0].sql).toContain('ORDER BY created_at DESC');
  });
});

describe('DbBranchManager — cleanupStale (REQ-08)', () => {
  it('selects stale branches, drops each, marks discarded, returns count', async () => {
    const staleRows = [
      { name: 'old1', schema: 'branch_old1' },
      { name: 'old2', schema: 'branch_old2' },
    ];
    const ds = makeMockDataSource([h('status', staleRows)]);
    const manager = new DbBranchManager(ds as never);
    const count = await manager.cleanupStale(24);

    expect(count).toBe(2);
    // Two DROP SCHEMA statements
    const drops = ds.calls.filter((c) => c.sql.includes('DROP SCHEMA'));
    expect(drops.length).toBe(2);
    // Two UPDATE status=discarded
    const updates = ds.calls.filter((c) =>
      c.sql.includes("status = 'discarded'"),
    );
    expect(updates.length).toBe(2);
  });

  it('uses the provided maxAgeHours in the stale selection query', async () => {
    const ds = makeMockDataSource([h('status', [])]);
    const manager = new DbBranchManager(ds as never);
    await manager.cleanupStale(48);

    expect(ds.calls[0].params).toEqual([48]);
  });

  it('returns 0 when there are no stale branches', async () => {
    const ds = makeMockDataSource([h('status', [])]);
    const manager = new DbBranchManager(ds as never);
    const count = await manager.cleanupStale(24);
    expect(count).toBe(0);
  });
});
