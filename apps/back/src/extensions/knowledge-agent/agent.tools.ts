import type { StructuredTool } from '@langchain/core/tools';
import { createSearchNotesTreeTool } from './tools/search-notes-tree.tool';
import { createSearchNotesSemanticTool } from './tools/search-notes-semantic.tool';
import { createCreateNoteTool } from './tools/create-note.tool';
import { createUpdateNoteTool } from './tools/update-note.tool';
import { createDeleteNoteTool } from './tools/delete-note.tool';
import type { NoteService } from './note.service';
import type { VectorStoreService } from './infrastructure/vector-store.service';

/**
 * Knowledge-agent tool factories.
 *
 * The KB tools need runtime injection (NoteService, VectorStoreService,
 * userId), so they cannot be exported as a static `tools` array. Instead this
 * file exports `createKnowledgeAgentTools(ctx)` which the
 * AgentFactoryService calls at build time, merging the returned tools with
 * the native tools (ToolRegistry), MCP tools (McpLoader), and the execute
 * tool (sandbox backend).
 *
 * The ToolRegistryService auto-discovery still imports this file, but since
 * there is no `tools` array export it returns null — KB tools are intentionally
 * wired by the factory, not the registry.
 */

export interface ToolContext {
  noteService: NoteService;
  vectorStoreService: VectorStoreService;
  userId: number;
}

/**
 * Build the five KB tools scoped to `ctx.userId`. The userId closure enforces
 * user scoping — the agent cannot read or mutate another user's notes.
 */
export function createKnowledgeAgentTools(ctx: ToolContext): StructuredTool[] {
  return [
    createSearchNotesTreeTool(ctx.noteService, ctx.userId),
    createSearchNotesSemanticTool(ctx.vectorStoreService),
    createCreateNoteTool(ctx.noteService, ctx.userId),
    createUpdateNoteTool(ctx.noteService, ctx.userId),
    createDeleteNoteTool(ctx.noteService, ctx.userId),
  ];
}