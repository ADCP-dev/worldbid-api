import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { NoteService } from '../note.service';

/**
 * get_note — read the FULL content of a single note by id.
 *
 * The list/search tools return metadata + snippets only; this tool returns
 * the complete markdown content plus metadata. Use it after locating a note
 * via list_notes / search_notes_semantic.
 */
export function createGetNoteTool(noteService: NoteService) {
  return tool(
    async ({ id }) => {
      const note = await noteService.findById(id);
      if (!note) {
        return JSON.stringify({ error: `Note ${id} not found` });
      }
      return JSON.stringify({
        id: note.id,
        title: note.title,
        categoryPath: note.categoryPath,
        tags: note.tags,
        updatedAt: note.updatedAt,
        content: note.contentMd,
      });
    },
    {
      name: 'get_note',
      description:
        'Read the FULL content of a single note by its id (ids come from list_notes or search_notes_semantic). Returns title, categoryPath, tags and the complete markdown content.',
      schema: z.object({
        id: z.string().describe('Note id (uuid) from list_notes or search results'),
      }),
    },
  );
}
