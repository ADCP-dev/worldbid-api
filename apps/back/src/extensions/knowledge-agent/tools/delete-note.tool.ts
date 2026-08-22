import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { NoteService } from '../note.service';

/**
 * delete_note — soft delete a note.
 *
 * Factory: receives the NoteService + userId. The NoteService.softDelete
 * throws `NotFoundException` if the note does not exist (or has already been
 * deleted), which surfaces to the agent as a tool error.
 */
export function createDeleteNoteTool(noteService: NoteService, _userId: number) {
  return tool(
    async ({ id }) => {
      await noteService.softDelete(id);
      return JSON.stringify({ id, success: true });
    },
    {
      name: 'delete_note',
      description:
        'Soft delete a note from the knowledge base. The note is marked as deleted (not hard-removed) and excluded from future searches.',
      schema: z.object({
        id: z.string().min(1).describe('The note id to delete'),
      }),
    },
  );
}