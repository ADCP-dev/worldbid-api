import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { SandboxService } from '../infrastructure/agent/sandbox.service';

/**
 * execute_js — run JavaScript in the isolated SandboxService interpreter.
 *
 * Factory: receives the SandboxService. Uses `evalJs` which runs the code in
 * a QuickJS WASM sandbox (fresh runtime per eval — no require, no process,
 * no network, no filesystem). The tool returns the console.log output plus
 * the final expression value; any eval failure surfaces as a JSON error
 * object so the agent can self-correct instead of crashing the loop.
 */
export function createJsEvalTool(sandbox: SandboxService) {
  return tool(
    async ({ code }) => {
      try {
        return await sandbox.evalJs(code);
      } catch (err) {
        return JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    {
      name: 'execute_js',
      description:
        'Run JavaScript in an isolated deterministic sandbox (QuickJS). Use for math, data transformations, parsing, sorting/aggregating JS arrays/objects, quick algorithms, and verifying computations. NOT for SQL/database access — use sql_query_readonly for that; combine both: query with SQL, then transform results with this tool. Globals are limited: console.log is available but there is no require, fetch, fs, process, or network access.',
      schema: z.object({
        code: z
          .string()
          .describe(
            'JavaScript expression or statements. console.log output and the final expression value are returned.',
          ),
      }),
    },
  );
}
