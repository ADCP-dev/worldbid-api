import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runPnpmScript, formatRunResult, type RunResult } from './_runner.js';

const BACK_CWD = 'apps/back';

function reply(result: RunResult, title: string) {
  return { content: [{ type: 'text' as const, text: formatRunResult(result, title) }] };
}

export function registerMaizzleTools(server: McpServer): void {
  server.tool(
    'maizzle_build',
    'Build production-ready email templates with Maizzle. Runs `pnpm maizzle:build` in apps/back (compiles templates and flattens the output for use).',
    {},
    async () => {
      const result = await runPnpmScript('maizzle:build', [], { cwd: BACK_CWD });
      return reply(result, 'maizzle:build');
    },
  );
}
