import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { NoteService } from '../note.service';

/**
 * list_categories — overview of the knowledge base folder structure.
 *
 * Returns every distinct category path with its note count so the agent can
 * orient itself before narrowing a search (e.g. "what categories exist?" →
 * "list notes in empresa" → "get_note …").
 */
export function createListCategoriesTool(noteService: NoteService) {
  return tool(
    async () => {
      const categories = await noteService.listCategories();
      return JSON.stringify(categories);
    },
    {
      name: 'list_categories',
      description:
        'List all categories (folders) in the knowledge base with their note counts. Use this FIRST to get an overview of what the knowledge base contains, then list_notes or get_note to drill in.',
      schema: z.object({}),
    },
  );
}
