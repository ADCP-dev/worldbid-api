import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { NoteService } from '../note.service';

/**
 * search_notes_tree — search notes by category_path hierarchy.
 *
 * Factory: receives the NoteService + userId (scoped to the requesting user)
 * and returns a LangChain Tool the DeepAgent can invoke. The userId closure
 * enforces user scoping — the agent cannot read another user's notes.
 */
export function createSearchNotesTreeTool(
  noteService: NoteService,
  userId: number,
) {
  return tool(
    async ({ categoryPath, depth }) => {
      const notes = await noteService.findByCategoryPath(userId, categoryPath, depth);
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
        'Search notes by category path hierarchy. Returns notes organized by tree level, scoped to the current user.',
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