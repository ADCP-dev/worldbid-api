import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runPnpmScript, formatRunResult, type RunResult } from './_runner.js';

const BACK_CWD = 'apps/back';

function reply(result: RunResult, title: string) {
  return { content: [{ type: 'text' as const, text: formatRunResult(result, title) }] };
}

export function registerQualityTools(server: McpServer): void {
  server.tool(
    'lint_back',
    'Run ESLint with auto-fix on the NestJS backend. Runs `pnpm lint` in apps/back (script: `eslint "{src,apps,libs,test}/**/*.ts" --fix`).',
    {},
    async () => {
      const result = await runPnpmScript('lint', [], { cwd: BACK_CWD });
      return reply(result, 'lint (apps/back)');
    },
  );

  server.tool(
    'check_types_back',
    'Type-check the NestJS backend with `tsc --noEmit`. Does NOT emit files. Runs `pnpm check-types` in apps/back.',
    {},
    async () => {
      const result = await runPnpmScript('check-types', [], { cwd: BACK_CWD });
      return reply(result, 'check-types (apps/back)');
    },
  );
}
