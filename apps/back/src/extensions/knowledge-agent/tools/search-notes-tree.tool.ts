import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { NoteService } from '../note.service';

/**
 * list_notes — list notes in the knowledge base.
 *
 * - No categoryPath (or "/" / ".") → ALL non-deleted notes.
 * - With categoryPath → that category and its full subtree.
 *
 * Global: the knowledge base is shared across all users. Returns metadata
 * only (id, title, categoryPath, tags) — use get_note to read full content.
 */
export function createSearchNotesTreeTool(noteService: NoteService) {
  return tool(
    async ({ categoryPath }) => {
      const path = (categoryPath ?? '').trim();
      // Root / empty → every note; otherwise the subtree via lquery.
      const notes =
        !path || path === '/' || path === '.'
          ? await noteService.findAll()
          : await noteService.findByCategoryPath(path, 10);
      return JSON.stringify(
        notes.map((n) => ({
          id: n.id,
          title: n.title,
          categoryPath: n.categoryPath,
          tags: n.tags,
          updatedAt: n.updatedAt,
        })),
      );
    },
    {
      name: 'list_notes',
      description:
        'List notes in the knowledge base. WITHOUT arguments lists ALL notes. With a categoryPath lists that category and its subcategories. Returns metadata (id, title, categoryPath, tags) — call get_note to read a note\'s full content.',
      schema: z.object({
        categoryPath: z
          .string()
          .optional()
          .describe(
            'Optional category path like "empresa" or "tech.notas". Omit to list ALL notes.',
          ),
      }),
    },
  );
}
