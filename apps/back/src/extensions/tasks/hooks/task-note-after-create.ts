/**
 * Task Note After Create Hook
 *
 * Fires after a task note is created. Notifies the parent task's assignee
 * that a note was added. Fire-and-forget: if the email cannot be sent, a
 * warning is logged and the hook resolves without throwing (after hooks are
 * non-blocking at the engine level too).
 *
 * Behavior:
 *   - Reads the parent task via ctx.getRepository('task').
 *   - If the task has an assigneeId, sends an email with the note content.
 *   - If the task has no assignee (null) or the task is not found, skips.
 *   - If sendEmail throws, logs a warning and returns.
 *
 * Introduced by change `tasks-v2-professional` (Slice 1).
 */

import type { HookContext } from '@core/spec-engine/spec.types';

interface TaskRow {
  id: number;
  title: string;
  assigneeId: number | null;
}

interface NoteRow {
  id: number;
  content: string;
  authorId: number | null;
  taskId: number;
}

export default async function taskNoteAfterCreate(
  entity: Record<string, unknown>,
  ctx: HookContext,
): Promise<void> {
  const note = entity as unknown as NoteRow;
  const taskRepo = ctx.getRepository('task');

  let task: TaskRow | null;
  try {
    task = await taskRepo.findOne({ where: { id: note.taskId } });
  } catch (err) {
    ctx.logger.warn(
      `task-note-after-create: could not load task ${note.taskId}: ${(err as Error).message}`,
    );
    return;
  }

  if (!task) {
    ctx.logger.warn(
      `task-note-after-create: parent task ${note.taskId} not found — skipping notification`,
    );
    return;
  }

  if (task.assigneeId == null) {
    // No assignee to notify.
    return;
  }

  const notificationEmail = ctx.config('app.notificationEmail');
  if (!notificationEmail) {
    ctx.logger.warn(
      'task-note-after-create: no app.notificationEmail configured — skipping notification',
    );
    return;
  }

  const subject = `New note on task "${task.title}"`;
  const text =
    `A note was added to task "${task.title}" (#${task.id}).\n\n` +
    `Note: "${note.content}"`;

  try {
    await ctx.sendEmail({
      to: notificationEmail,
      subject,
      templateName: 'task-note',
      config: {
        subject,
        taskTitle: task.title,
        taskId: task.id,
        noteContent: note.content,
        lang: 'en',
      },
      text,
    });
    ctx.logger.log(
      `task-note-after-create: notified assignee of task ${task.id} about note ${note.id}`,
    );
  } catch (err) {
    // Fire-and-forget: email failures must not break note creation.
    ctx.logger.warn(
      `task-note-after-create: failed to send notification email: ${(err as Error).message}`,
    );
  }
}