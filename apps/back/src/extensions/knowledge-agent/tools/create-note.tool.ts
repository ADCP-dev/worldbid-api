import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { NoteService } from '../note.service';

/**
 * create_note — create a new note in the GLOBAL knowledge base.
 *
 * Factory: receives the NoteService. Notes are global (shared knowledge
 * base) — the created note is visible to all users. On success the
 * NoteService enqueues an async embedding job (Bull) so `create` returns
 * immediately with the note id (Q-13: always async).
 */
export function createCreateNoteTool(noteService: NoteService) {
  return tool(
    async ({ title, contentMd, categoryPath, tags }) => {
      const note = await noteService.create({
        title,
        contentMd,
        categoryPath,
        tags,
      });
      return JSON.stringify({ id: note.id, success: true });
    },
    {
      name: 'create_note',
      description:
        'Create a new note in the shared knowledge base. The note is visible to all users and an embedding is generated asynchronously.',
      schema: z.object({
        title: z.string().min(1).describe('The note title (non-empty)'),
        contentMd: z.string().min(1).describe('Markdown content of the note'),
        categoryPath: z
          .string()
          .optional()
          .describe('Category path like "frontend/frameworks"'),
        tags: z.array(z.string()).optional().describe('List of tags'),
      }),
    },
  );
}