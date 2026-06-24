import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  command: string;
  cwd: string;
};

export type RunOptions = {
  cwd: string;
  timeoutMs?: number;
  env?: Record<string, string | undefined>;
};

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

// Workspace root: env var override or process CWD.
// All tool CWDs are resolved against this so the MCP server works
// regardless of where the host (opencode, claude desktop, etc.) launched it.
const WORKSPACE_ROOT = path.resolve(
  process.env.FOUNDATION_ROOT ?? process.cwd(),
);

export function resolveCwd(...parts: string[]): string {
  return path.resolve(WORKSPACE_ROOT, ...parts);
}

// Pre-check that apps/back has been built. Required by tools that read from
// dist/ (migration_run, migration_revert, seed_run).
export function assertBackBuilt(): { ok: true; dataSourcePath: string } | { ok: false; error: string } {
  const dataSourcePath = resolveCwd('apps', 'back', 'dist', 'infrastructure', 'database', 'data-source.js');
  if (!existsSync(dataSourcePath)) {
    return {
      ok: false,
      error:
        `apps/back/dist/ is missing. Run \`pnpm --filter back build\` first.\n` +
        `Expected: ${dataSourcePath}`,
    };
  }
  return { ok: true, dataSourcePath };
}

export function runCommand(
  command: string,
  args: string[],
  options: RunOptions,
): Promise<RunResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cmdStr = [command, ...args]
    .map((a) => (/\s/.test(a) ? `"${a}"` : a))
    .join(' ');

  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: options.cwd,
      shell: true,
      env: { ...process.env, ...(options.env ?? {}) } as NodeJS.ProcessEnv,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 5000);
    }, timeoutMs);

    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timer);
      stderr += `\n[spawn error] ${err.message}`;
      resolve({
        stdout,
        stderr,
        exitCode: -1,
        timedOut,
        command: cmdStr,
        cwd: options.cwd,
      });
    });

    proc.on('close', (code: number | null) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: timedOut ? `${stderr}\n[timeout after ${timeoutMs}ms]` : stderr,
        exitCode: code ?? -1,
        timedOut,
        command: cmdStr,
        cwd: options.cwd,
      });
    });
  });
}

export function runPnpmScript(
  script: string,
  args: string[],
  options: RunOptions,
): Promise<RunResult> {
  return runCommand('pnpm', [script, ...args], options);
}

export function formatRunResult(result: RunResult, title: string): string {
  const status = result.timedOut
    ? '⏱️ TIMEOUT'
    : result.exitCode === 0
      ? '✅ OK'
      : `❌ EXIT ${result.exitCode}`;
  const lines = [
    `# ${title}`,
    '',
    `**Status:** ${status}`,
    `**Command:** \`${result.command}\``,
    `**CWD:** \`${result.cwd}\``,
    '',
    '## stdout',
    '',
    '```',
    result.stdout.trim() || '(empty)',
    '```',
    '',
    '## stderr',
    '',
    '```',
    result.stderr.trim() || '(empty)',
    '```',
  ];
  return lines.join('\n') + '\n';
}
