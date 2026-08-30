import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/** Kill the child after this many ms (SIGTERM, then SIGKILL after grace). */
const SHELL_TIMEOUT_MS = 30_000;
/** stdout/stderr are truncated to this many characters each. */
const SHELL_MAX_OUTPUT = 64 * 1024;
/** Grace period before SIGKILL when the child ignores SIGTERM. */
const SHELL_KILL_GRACE_MS = 1_000;
/**
 * Only these variables pass through to the child — never DATABASE_URL, API
 * keys, or any other app secret. SANDBOX=1 marks the restricted environment.
 */
const SHELL_ENV_KEYS = ['PATH', 'HOME', 'LANG', 'TMPDIR'] as const;

/** Minimal environment: allow-listed keys from process.env + SANDBOX=1. */
function buildSandboxEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { SANDBOX: '1' };
  for (const key of SHELL_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

function truncateOutput(output: string): string {
  return output.length > SHELL_MAX_OUTPUT
    ? output.slice(0, SHELL_MAX_OUTPUT)
    : output;
}

/**
 * run_command — execute a shell command via `/bin/sh -c` inside the backend
 * server's container. Runs with cwd set to an isolated scratch dir and a
 * minimal environment (no app secrets). Guardrails: 30s timeout (SIGTERM
 * then SIGKILL after a short grace), 64 KiB output truncation per stream.
 * Trust boundary is the admin role (the tool is admin-gated in
 * AgentFactoryService) — the stripped env is defense in depth, NOT a hard
 * security boundary. Errors (spawn failure, timeout) surface as JSON error
 * objects so the agent can self-correct instead of crashing the loop.
 */
export function createShellExecTool(opts: {
  workDir: string;
  /** Override for tests; defaults to SHELL_TIMEOUT_MS. */
  timeoutMs?: number;
}) {
  const timeoutMs = opts.timeoutMs ?? SHELL_TIMEOUT_MS;
  return tool(
    async ({ command }) => {
      mkdirSync(opts.workDir, { recursive: true });

      return await new Promise<string>((resolve) => {
        let stdout = '';
        let stderr = '';
        let settled = false;
        let killTimer: ReturnType<typeof setTimeout> | null = null;

        const finish = (payload: Record<string, unknown>) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(JSON.stringify(payload));
        };

        const child = spawn('/bin/sh', ['-c', command], {
          cwd: opts.workDir,
          env: buildSandboxEnv(),
        });

        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          // Escalate to SIGKILL if the child ignores the grace period.
          killTimer = setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null) {
              child.kill('SIGKILL');
            }
          }, SHELL_KILL_GRACE_MS);
          finish({ error: 'timed out' });
        }, timeoutMs);

        child.stdout?.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
        });
        child.stderr?.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.on('error', (err: Error) => {
          finish({ error: err.message });
        });
        child.on('close', (code: number | null) => {
          if (killTimer) clearTimeout(killTimer);
          finish({
            exitCode: code,
            stdout: truncateOutput(stdout),
            stderr: truncateOutput(stderr),
          });
        });
      });
    },
    {
      name: 'run_command',
      description:
        "Execute a shell command (sh) inside the platform server's container. " +
        'The working directory is an isolated scratch dir. Environment is ' +
        'minimal (no app secrets). Use for file processing, text tools (jq, ' +
        'grep, awk), curl to public APIs, or running quick scripts. Output is ' +
        'truncated; command is killed on timeout.',
      schema: z.object({
        command: z
          .string()
          .describe(
            'Shell command to run, e.g. "ls -la" or "cat notes.txt | wc -l"',
          ),
      }),
    },
  );
}
