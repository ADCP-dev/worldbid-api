import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runPnpmScript, formatRunResult, type RunResult } from './_runner.js';

const BACK_CWD = 'apps/back';

function reply(result: RunResult, title: string, warning?: string) {
  const text = warning
    ? `> ⚠️ ${warning}\n\n${formatRunResult(result, title)}`
    : formatRunResult(result, title);
  return { content: [{ type: 'text' as const, text }] };
}

const INTERACTIVE_WARNING =
  'This command is interactive — it prompts for input via stdin. ' +
  'MCP stdio transport cannot forward stdin, so the command will likely HANG until the 5-minute timeout. ' +
  'Run it manually in a terminal instead: `pnpm --filter back translation:add`';

export function registerTranslationTools(server: McpServer): void {
  server.tool(
    'translation_add',
    'Add a new translation key interactively. ⚠️ INTERACTIVE COMMAND — see warning above. Runs `pnpm translation:add` in apps/back.',
    {},
    async () => {
      const result = await runPnpmScript('translation:add', [], { cwd: BACK_CWD });
      return reply(result, 'translation:add', INTERACTIVE_WARNING);
    },
  );

  server.tool(
    'translation_sync',
    'Sync translation files across all configured languages. Runs `pnpm translation:sync` in apps/back.',
    {},
    async () => {
      const result = await runPnpmScript('translation:sync', [], { cwd: BACK_CWD });
      return reply(result, 'translation:sync');
    },
  );
}
