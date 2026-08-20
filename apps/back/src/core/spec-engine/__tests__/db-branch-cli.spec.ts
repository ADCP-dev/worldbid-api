/**
 * db-branch-cli — TDD tests for change `agent-native-prd04-db-branching` (REQ-10).
 *
 * Covers:
 *   - subcommand dispatch (create / list / discard / merge / cleanup)
 *   - flag parsing (--name, --copy-data, --parent, --json, --max-age-hours)
 *   - exit codes (0 success, 1 error)
 *   - --json flag on list → machine-readable JSON output
 *   - unknown subcommand → error + exit 1
 *
 * Strategy: mock DbBranchManager methods + capture console.log/console.error
 * and process.exit. AppDataSource is mocked via vi.mock on the data-source module.
 */
import { vi } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockManager = {
  createBranch: vi.fn(),
  listBranches: vi.fn(),
  discardBranch: vi.fn(),
  mergeBranch: vi.fn(),
  cleanupStale: vi.fn(),
};

// Stub DbBranchManager so the CLI's `new DbBranchManager(ds)` returns our mock.
// vi.fn().mockImplementation doesn't work with `new`; use a real function.
function MockDbBranchManagerConstructor(this: unknown) {
  return mockManager;
}
vi.mock('@src/core/spec-engine/db-branch-manager', () => ({
  DbBranchManager: MockDbBranchManagerConstructor as never,
}));

// Stub AppDataSource so the CLI doesn't open a real DB connection.
vi.mock('@src/infrastructure/database/data-source', () => ({
  AppDataSource: { options: { type: 'postgres' } },
}));

import { runCli } from '@src/core/spec-engine/db-branch-cli';

// ─── Test harness ────────────────────────────────────────────────────────────
//
// process.exit is stubbed to set the exit code and return (not throw), so the
// CLI's try/catch is not triggered by the exit itself. The CLI's switch cases
// all `break` after calling process.exit, so flow exits the switch and the try
// block completes normally.

interface CliResult {
  exitCode: number | null;
  stdout: string[];
  stderr: string[];
}

async function run(args: string[]): Promise<CliResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exitCode: number | null = null;

  const origArgv = process.argv;
  const origLog = console.log;
  const origErr = console.error;
  const origExit = process.exit;

  process.argv = ['node', 'db-branch-cli.ts', ...args];
  console.log = ((...a: unknown[]) => stdout.push(a.join(' '))) as never;
  console.error = ((...a: unknown[]) => stderr.push(a.join(' '))) as never;
  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
  }) as never;

  try {
    await runCli();
  } finally {
    process.argv = origArgv;
    console.log = origLog;
    console.error = origErr;
    process.exit = origExit;
  }

  return { exitCode, stdout, stderr };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('db-branch-cli — create (REQ-10)', () => {
  it('calls createBranch with parsed --name and --copy-data', async () => {
    mockManager.createBranch.mockResolvedValue({
      name: 'test-001', schema: 'branch_test-001', status: 'active',
    });
    const res = await run(['create', '--name=test-001', '--copy-data']);

    expect(res.exitCode).toBe(0);
    expect(mockManager.createBranch).toHaveBeenCalledWith({
      name: 'test-001',
      copyData: true,
    });
  });

  it('passes --parent as parentSchema', async () => {
    mockManager.createBranch.mockResolvedValue({ name: 'x', schema: 'branch_x' });
    await run(['create', '--name=x', '--parent=staging']);

    expect(mockManager.createBranch).toHaveBeenCalledWith({
      name: 'x',
      copyData: false,
      parentSchema: 'staging',
    });
  });

  it('exits 1 and prints error when createBranch throws', async () => {
    mockManager.createBranch.mockRejectedValue(new Error('schema exists'));
    const res = await run(['create', '--name=dup']);

    expect(res.exitCode).toBe(1);
    expect(res.stderr.some((s) => s.includes('schema exists'))).toBe(true);
  });
});

describe('db-branch-cli — list (REQ-10)', () => {
  it('calls listBranches and prints human-readable output', async () => {
    mockManager.listBranches.mockResolvedValue([
      { name: 'b1', schema: 'branch_b1', status: 'active', parentSchema: 'public', copyData: true, createdBy: 'agent1', createdAt: '2026-08-20T00:00:00Z' },
    ]);
    const res = await run(['list']);

    expect(res.exitCode).toBe(0);
    expect(mockManager.listBranches).toHaveBeenCalled();
    expect(res.stdout.some((s) => s.includes('b1'))).toBe(true);
  });

  it('prints JSON when --json flag is passed', async () => {
    mockManager.listBranches.mockResolvedValue([
      { name: 'b1', schema: 'branch_b1', status: 'active', parentSchema: 'public', copyData: true, createdBy: 'agent1', createdAt: '2026-08-20T00:00:00Z' },
    ]);
    const res = await run(['list', '--json']);

    expect(res.exitCode).toBe(0);
    const jsonLine = res.stdout.find((s) => s.startsWith('['));
    expect(jsonLine).toBeDefined();
    const parsed = JSON.parse(jsonLine!);
    expect(parsed[0].name).toBe('b1');
  });
});

describe('db-branch-cli — discard (REQ-10)', () => {
  it('calls discardBranch with the branch object', async () => {
    mockManager.listBranches.mockResolvedValue([
      { name: 'dc', schema: 'branch_dc', status: 'active', parentSchema: 'public', copyData: false, createdBy: 'manual', createdAt: '2026-08-20T00:00:00Z' },
    ]);
    mockManager.discardBranch.mockResolvedValue(undefined);
    const res = await run(['discard', '--name=dc']);

    expect(res.exitCode).toBe(0);
    expect(mockManager.discardBranch).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'dc', schema: 'branch_dc' }),
    );
  });

  it('exits 1 when branch name not found', async () => {
    mockManager.listBranches.mockResolvedValue([]);
    const res = await run(['discard', '--name=missing']);

    expect(res.exitCode).toBe(1);
    expect(res.stderr.some((s) => s.includes('not found'))).toBe(true);
  });
});

describe('db-branch-cli — merge (REQ-10)', () => {
  it('calls mergeBranch with the branch object', async () => {
    mockManager.listBranches.mockResolvedValue([
      { name: 'mg', schema: 'branch_mg', status: 'active', parentSchema: 'public', copyData: false, createdBy: 'manual', createdAt: '2026-08-20T00:00:00Z' },
    ]);
    mockManager.mergeBranch.mockResolvedValue(undefined);
    const res = await run(['merge', '--name=mg']);

    expect(res.exitCode).toBe(0);
    expect(mockManager.mergeBranch).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'mg', schema: 'branch_mg' }),
    );
  });
});

describe('db-branch-cli — cleanup (REQ-10)', () => {
  it('calls cleanupStale with default 24h', async () => {
    mockManager.cleanupStale.mockResolvedValue(3);
    const res = await run(['cleanup']);

    expect(res.exitCode).toBe(0);
    expect(mockManager.cleanupStale).toHaveBeenCalledWith(24);
    expect(res.stdout.some((s) => s.includes('3'))).toBe(true);
  });

  it('passes --max-age-hours as number', async () => {
    mockManager.cleanupStale.mockResolvedValue(0);
    await run(['cleanup', '--max-age-hours=48']);

    expect(mockManager.cleanupStale).toHaveBeenCalledWith(48);
  });
});

describe('db-branch-cli — dispatch errors (REQ-10)', () => {
  it('exits 1 on unknown subcommand', async () => {
    const res = await run(['bogus']);

    expect(res.exitCode).toBe(1);
    expect(res.stderr.some((s) => s.includes('Unknown') || s.includes('Usage'))).toBe(true);
  });

  it('exits 1 when no subcommand given', async () => {
    const res = await run([]);

    expect(res.exitCode).toBe(1);
    expect(res.stderr.some((s) => s.includes('Usage'))).toBe(true);
  });
});