import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { NoteService } from '../note.service';

/**
 * search_notes_tree — search notes by category_path hierarchy.
 *
 * Factory: receives the NoteService and returns a LangChain Tool the
 * DeepAgent can invoke. Notes are GLOBAL (shared knowledge base) — the tool
 * searches across ALL notes regardless of the requesting user.
 */
export function createSearchNotesTreeTool(noteService: NoteService) {
  return tool(
    async ({ categoryPath, depth }) => {
      const notes = await noteService.findByCategoryPath(categoryPath, depth);
      return JSON.stringify(
        notes.map((n) => ({
          id: n.id,
          title: n.title,
          categoryPath: n.categoryPath,
          tags: n.tags,
        })),
      );
    },
    {
      name: 'search_notes_tree',
      description:
        'Search notes by category path hierarchy. Returns notes organized by tree level. The knowledge base is shared across all users.',
      schema: z.object({
        categoryPath: z
          .string()
          .describe('Category path like "frontend/frameworks"'),
        depth: z
          .number()
          .int()
          .min(1)
          .max(10)
          .default(2)
          .describe('Depth levels to search (1 = exact, 2 = one level down)'),
      }),
    },
  );
}