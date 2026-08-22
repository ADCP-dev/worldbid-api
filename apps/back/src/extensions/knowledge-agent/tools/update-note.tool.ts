import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { NoteService } from '../note.service';

/**
 * update_note — update an existing note.
 *
 * Factory: receives the NoteService. Only the provided fields are patched
 * (partial update). When `contentMd` changes, the NoteService re-enqueues an
 * embedding job so the vector stays in sync (Q-13).
 */
export function createUpdateNoteTool(noteService: NoteService) {
  return tool(
    async ({ id, title, contentMd, categoryPath, tags }) => {
      const patch: Record<string, unknown> = {};
      if (title !== undefined) patch.title = title;
      if (contentMd !== undefined) patch.contentMd = contentMd;
      if (categoryPath !== undefined) patch.categoryPath = categoryPath;
      if (tags !== undefined) patch.tags = tags;
      await noteService.update(id, patch);
      return JSON.stringify({ id, success: true });
    },
    {
      name: 'update_note',
      description:
        'Update an existing note. Only the provided fields are patched. When content changes, the embedding is regenerated asynchronously.',
      schema: z.object({
        id: z.string().min(1).describe('The note id to update'),
        title: z.string().optional().describe('New title'),
        contentMd: z.string().optional().describe('New markdown content'),
        categoryPath: z.string().optional().describe('New category path'),
        tags: z.array(z.string()).optional().describe('New list of tags'),
      }),
    },
  );
}