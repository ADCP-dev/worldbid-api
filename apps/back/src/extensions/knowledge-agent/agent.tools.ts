import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Native tools exported by the knowledge-agent extension.
 *
 * The ToolRegistryService auto-discovers this file and merges `tools` into the
 * agent's toolset at build time. Tools that require runtime injection (e.g.
 * the VfsBackend for `execute`) are constructed by the AgentFactoryService and
 * merged separately — see tools/execute.tool.ts.
 */

const echo_tool = tool(
  async ({ message }) => ({ message }),
  {
    name: 'echo',
    description: 'Echo back the provided message. Useful for debugging agent tool wiring.',
    schema: z.object({
      message: z.string().describe('The message to echo back'),
    }),
  },
);

const list_notes_tool = tool(
  async () => ({
    note: 'Use the search_notes_semantic or search_notes_tree tools (available in Phase 4) to query the knowledge base.',
  }),
  {
    name: 'list_notes',
    description: 'List available notes tools. Phase 3 stub — real note tools arrive in Phase 4.',
    schema: z.object({}),
  },
);

export const tools = [echo_tool, list_notes_tool];