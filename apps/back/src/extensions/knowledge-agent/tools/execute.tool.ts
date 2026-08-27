import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * execute — run a shell command inside the agent's VfsBackend sandbox.
 *
 * The backend is injected by the AgentFactoryService at build time; this tool
 * factory accepts the backend + permissions and returns a LangChain Tool the
 * agent can call. The command runs isolated in the virtual filesystem, NOT on
 * the host.
 */
export function createExecuteTool(backend: unknown) {
  return tool(
    async ({ command, args }) => {
      // The VfsBackend exposes an `execute` method when the agent runtime
      // wires it. We call it dynamically to avoid coupling the tool type to
      // the (optional) @langchain/node-vfs types at compile time.
      const b = backend as { execute?: (cmd: string) => Promise<{ output?: string; error?: string }> };
      if (typeof b?.execute !== 'function') {
        return { error: 'Sandbox backend is not available' };
      }
      try {
        const full = args.length > 0 ? `${command} ${args.join(' ')}` : command;
        const result = await b.execute(full);
        return { output: result.output ?? '', error: result.error ?? null };
      } catch (err) {
        return {
          output: '',
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    {
      name: 'run_command',
      description:
        'Execute a shell command inside the isolated virtual filesystem sandbox. Use for running scripts, inspecting files, or testing code.',
      schema: z.object({
        command: z.string().describe('The command to run, e.g. "node" or "ls"'),
        args: z.array(z.string()).default([]).describe('Arguments for the command'),
      }),
    },
  );
}