import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { VectorStoreService } from '../infrastructure/vector-store.service';

/**
 * search_notes_semantic — similarity search over note embeddings (pgvector).
 *
 * Factory: receives the VectorStoreService (which wraps PGVectorStore) and
 * returns a LangChain Tool. Delegates to `similaritySearch(query, topK)` which
 * computes cosine similarity over the HNSW index and excludes notes whose
 * `embedding` is NULL (not yet embedded).
 */
export function createSearchNotesSemanticTool(
  vectorStoreService: VectorStoreService,
) {
  return tool(
    async ({ query, topK }) => {
      const hits = await vectorStoreService.similaritySearch(query, topK);
      return JSON.stringify(hits);
    },
    {
      name: 'search_notes_semantic',
      description:
        'Semantic similarity search over the knowledge base. Returns the most relevant notes for the query, ordered by cosine similarity. Use this when the user asks about a concept rather than an exact category.',
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