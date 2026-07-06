import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runPnpmScript, formatRunResult, resolveCwd, assertBackBuilt, type RunResult } from './_runner.js';

const BACK_CWD = resolveCwd('apps', 'back');

function reply(result: RunResult, title: string) {
  return { content: [{ type: 'text' as const, text: formatRunResult(result, title) }] };
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

export function registerMigrationTools(server: McpServer): void {
  server.tool(
    'migration_generate',
    'Generate a TypeORM migration by comparing entities against the database. Runs `pnpm migration:generate <name>` in apps/back. Does NOT require a prior build. The name must be PascalCase (e.g., "AddUserEmail").',
    {
      name: z
        .string()
        .min(1)
        .describe('PascalCase migration name (e.g., "AddUserEmailColumn")'),
    },
    async ({ name }) => {
      const result = await runPnpmScript('migration:generate', [name], { cwd: BACK_CWD });
      return reply(result, `migration:generate ${name}`);
    },
  );

  server.tool(
    'migration_run',
    'Run all pending TypeORM migrations. REQUIRES a prior build (`pnpm --filter back build`) because it reads from `dist/infrastructure/database/data-source.js`. The tool pre-checks for dist/ and returns a clear error if missing. Runs `pnpm migration:run` in apps/back.',
    {},
    async () => {
      const check = assertBackBuilt();
      if (!check.ok) {
        return buildRequiredError();
      }
      const result = await runPnpmScript('migration:run', [], { cwd: BACK_CWD });
      return reply(result, 'migration:run');
    },
  );

  server.tool(
    'migration_revert',
    'Revert the last applied TypeORM migration. REQUIRES a prior build (`pnpm --filter back build`). The tool pre-checks for dist/ and returns a clear error if missing. Runs `pnpm migration:revert` in apps/back.',
    {},
    async () => {
      const check = assertBackBuilt();
      if (!check.ok) {
        return buildRequiredError();
      }
      const result = await runPnpmScript('migration:revert', [], { cwd: BACK_CWD });
      return reply(result, 'migration:revert');
    },
  );
}
