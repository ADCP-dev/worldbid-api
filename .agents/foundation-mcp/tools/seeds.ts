import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runPnpmScript, formatRunResult, resolveCwd, assertBackBuilt, type RunResult } from './_runner.js';

const BACK_CWD = resolveCwd('apps', 'back');

function reply(result: RunResult, title: string, warning?: string) {
  const text = warning
    ? `> ⚠️ ${warning}\n\n${formatRunResult(result, title)}`
    : formatRunResult(result, title);
  return { content: [{ type: 'text' as const, text }] };
}

function buildRequiredError(): { content: [{ type: 'text'; text: string }] } {
  const check = assertBackBuilt();
  return {
    content: [
      {
        type: 'text',
        text: `❌ ${check.ok ? '' : check.error}\n\n` +
          `> Run \`pnpm --filter back build\` before invoking tools that read from dist/.\n`,
      },
    ],
  };
}

const INTERACTIVE_WARNING =
  '`seed:create` is interactive (Hygen prompts for input). ' +
  'MCP stdio transport cannot forward stdin, so the command will likely HANG until the 5-minute timeout. ' +
  'Run it manually in a terminal: `pnpm --filter back seed:create`';

export function registerSeedTools(server: McpServer): void {
  server.tool(
    'seed_run',
    'Run all database seeders. REQUIRES a prior build (`pnpm --filter back build`) because it executes from `dist/`. The tool pre-checks for dist/ and returns a clear error if missing. Runs `pnpm seed:run` in apps/back.',
    {},
    async () => {
      const check = assertBackBuilt();
      if (!check.ok) {
        return buildRequiredError();
      }
      const result = await runPnpmScript('seed:run', [], { cwd: BACK_CWD });
      return reply(result, 'seed:run');
    },
  );

  server.tool(
    'seed_create',
    'Create a new empty seed file via Hygen. ⚠️ INTERACTIVE COMMAND — see warning above. Runs `pnpm seed:create` in apps/back.',
    {
      name: z
        .string()
        .min(1)
        .optional()
        .describe('Optional seed name (PascalCase). If omitted, Hygen will prompt.'),
    },
    async ({ name }) => {
      const args = name ? [name] : [];
      const result = await runPnpmScript('seed:create', args, { cwd: BACK_CWD });
      return reply(result, `seed:create ${name ?? ''}`.trim(), INTERACTIVE_WARNING);
    },
  );
}
