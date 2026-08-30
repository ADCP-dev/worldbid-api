import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { createShellExecTool } from './shell-exec.tool';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
vi.mock('node:fs', () => ({ mkdirSync: vi.fn() }));

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const spawnMock = vi.mocked(spawn);
const mkdirSyncMock = vi.mocked(mkdirSync);

const makeChild = () => {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
    exitCode: number | null;
    signalCode: string | null;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  child.exitCode = null;
  child.signalCode = null;
  return child;
};

describe('run_command tool (shell exec)', () => {
  const workDir = '/tmp/ka-exec-test';
  let child: ReturnType<typeof makeChild>;

  beforeEach(() => {
    spawnMock.mockReset();
    mkdirSyncMock.mockReset();
    child = makeChild();
    spawnMock.mockImplementation(() => child);
  });

  /** tool.invoke validates the schema async — wait until spawn happened. */
  const waitForSpawn = () =>
    vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));

  it('should return exitCode/stdout/stderr JSON on success', async () => {
    const tool = createShellExecTool({ workDir });
    const pending = tool.invoke({ command: 'ls -la' });
    await waitForSpawn();

    child.stdout.emit('data', Buffer.from('file.txt\n'));
    child.stderr.emit('data', Buffer.from('warn\n'));
    child.emit('close', 0);
    const result = await pending;

    expect(JSON.parse(result as string)).toEqual({
      exitCode: 0,
      stdout: 'file.txt\n',
      stderr: 'warn\n',
    });
    expect(spawnMock).toHaveBeenCalledWith(
      '/bin/sh',
      ['-c', 'ls -la'],
      expect.objectContaining({ cwd: workDir }),
    );
    expect(mkdirSyncMock).toHaveBeenCalledWith(workDir, { recursive: true });
  });

  it('should kill the child and return a timeout error when it exceeds timeoutMs', async () => {
    const tool = createShellExecTool({ workDir, timeoutMs: 5 });
    const pending = tool.invoke({ command: 'sleep 100' });
    await waitForSpawn();

    const result = await pending; // child never emits close

    expect(JSON.parse(result as string)).toEqual({ error: 'timed out' });
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('should truncate stdout beyond SHELL_MAX_OUTPUT', async () => {
    const tool = createShellExecTool({ workDir });
    const pending = tool.invoke({ command: 'yes | head -c 200000' });
    await waitForSpawn();

    child.stdout.emit('data', Buffer.from('x'.repeat(100_000)));
    child.emit('close', 0);
    const result = await pending;

    const parsed = JSON.parse(result as string) as { stdout: string };
    expect(parsed.stdout).toHaveLength(64 * 1024);
  });

  it('should not pass app env vars to the child (allow-list only)', async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgres://secret/preview-db';
    try {
      const tool = createShellExecTool({ workDir });
      const pending = tool.invoke({ command: 'env' });
      await waitForSpawn();
      child.emit('close', 0);
      await pending;

      const options = spawnMock.mock.calls[0][2] as {
        cwd: string;
        env: NodeJS.ProcessEnv;
      };
      expect(options.env.DATABASE_URL).toBeUndefined();
      expect(options.env.SANDBOX).toBe('1');
      expect(options.env.PATH).toBe(process.env.PATH);
    } finally {
      if (original === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = original;
    }
  });

  it('should return a JSON error object when spawn fails', async () => {
    const tool = createShellExecTool({ workDir });
    const pending = tool.invoke({ command: 'ls' });
    await waitForSpawn();

    child.emit('error', new Error('spawn /bin/sh ENOENT'));
    const result = await pending;

    expect(JSON.parse(result as string)).toEqual({
      error: 'spawn /bin/sh ENOENT',
    });
  });
});
