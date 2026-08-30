import type { StructuredTool } from '@langchain/core/tools';
import { createSearchNotesTreeTool } from './tools/search-notes-tree.tool';
import { createSearchNotesSemanticTool } from './tools/search-notes-semantic.tool';
import { createListCategoriesTool } from './tools/list-categories.tool';
import { createGetNoteTool } from './tools/get-note.tool';
import { createCreateNoteTool } from './tools/create-note.tool';
import { createUpdateNoteTool } from './tools/update-note.tool';
import { createDeleteNoteTool } from './tools/delete-note.tool';
import type { NoteService } from './note.service';
import type { VectorStoreService } from './infrastructure/vector-store.service';

/**
 * Knowledge-agent tool factories.
 *
 * The KB tools need runtime injection (NoteService, VectorStoreService), so
 * they cannot be exported as a static `tools` array. Instead this file
 * exports `createKnowledgeAgentTools(ctx)` which the AgentFactoryService
 * calls at build time, merging the returned tools with the MCP tools
 * (McpLoader), the service tools (sql_query_readonly, execute_js sandbox
 * eval, get_current_datetime), and the deepagents VFS built-ins.
 *
 * The ToolRegistryService auto-discovery still imports this file, but since
 * there is no `tools` array export it returns null — KB tools are
 * intentionally wired by the factory, not the registry.
 *
 * Notes + configs are GLOBAL (shared knowledge base). KB tools do NOT take a
 * userId — any authenticated agent sees and mutates the full KB. ChatSession
 * keeps per-user isolation at the controller/service layer.
 */

export interface ToolContext {
  noteService: NoteService;
  vectorStoreService: VectorStoreService;
}

/**
 * Build the five KB tools. The knowledge base is GLOBAL — no userId closure
 * is needed. The agent can read and mutate any note.
 */
export function createKnowledgeAgentTools(ctx: ToolContext): StructuredTool[] {
  return [
    // Read/discover
    createListCategoriesTool(ctx.noteService),
    createSearchNotesTreeTool(ctx.noteService),
    createSearchNotesSemanticTool(ctx.vectorStoreService, ctx.noteService),
    createGetNoteTool(ctx.noteService),
    // Mutate
    createCreateNoteTool(ctx.noteService),
    createUpdateNoteTool(ctx.noteService),
    createDeleteNoteTool(ctx.noteService),
  ];
}