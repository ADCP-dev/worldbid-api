import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { NoteService } from '../note.service';
import type { VectorStoreService } from '../infrastructure/vector-store.service';

/**
 * search_notes_semantic — relevance search over the knowledge base.
 *
 * Primary strategy: pgvector cosine similarity (needs embeddings indexed).
 * Fallback: Postgres full-text + ILIKE keyword search — the vector store is
 * unavailable whenever the embeddings provider is down (e.g. local Ollama
 * not running), and returning an empty result in that case made the agent
 * believe the KB was empty. The fallback guarantees the agent can always
 * find notes by keywords.
 *
 * Factory receives both services so the fallback needs no DI gymnastics.
 */
export function createSearchNotesSemanticTool(
  vectorStoreService: VectorStoreService,
  noteService: NoteService,
) {
  return tool(
    async ({ query, topK }) => {
      // 1) Try vector search first.
      let vectorHits: unknown = null;
      try {
        vectorHits = await vectorStoreService.similaritySearch(query, topK);
      } catch {
        vectorHits = null;
      }

      if (Array.isArray(vectorHits) && vectorHits.length > 0) {
        return JSON.stringify(vectorHits);
      }

      // 2) Fallback: keyword search (FTS + ILIKE). Always functional.
      const keywordHits = await noteService.keywordSearch(query, topK);
      return JSON.stringify(
        keywordHits.map((h) => ({
          id: h.id,
          title: h.title,
          categoryPath: h.categoryPath,
          tags: h.tags,
          snippet: h.snippet,
          source: 'keyword',
        })),
      );
    },
    {
      name: 'search_notes_semantic',
      description:
        'Relevance search over the knowledge base (semantic when available, keyword fallback otherwise). Returns the most relevant notes for the query with a content snippet. Use this when the user asks about a concept rather than an exact category. The knowledge base is shared across all users.',
      schema: z.object({
        query: z.string().describe('The natural-language query to search for'),
        topK: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(5)
          .describe('Maximum number of notes to return'),
      }),
    },
  );
}
