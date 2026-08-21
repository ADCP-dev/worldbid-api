/**
 * Overdue Tasks Detector — Job Handler
 *
 * Runs daily at 08:00 (cron `0 8 * * *`, defined in task.spec.yaml).
 * Detects tasks whose `dueDate` has passed and whose status is not `done`.
 * Triggers the `notify-overdue` notification via the notification system.
 *
 * Introduced by change `spec-engine-v2-frontend-and-loader` (Slice 7) as part
 * of the canonical example redesign. Implementation is intentionally minimal:
 * it queries the task repository for overdue, non-done tasks and emails the
 * configured notification address.
 */

import type { HookContext } from '@core/spec-engine/spec.types';

export default async function overdueTasksDetector(
  ctx: HookContext,
): Promise<void> {
  ctx.logger.log('Checking for overdue tasks...');

  const taskRepo = ctx.getRepository('task');
  const now = new Date();

  try {
    const overdue = await taskRepo
      .createQueryBuilder('task')
      .where('task.dueDate IS NOT NULL')
      .andWhere('task.dueDate < :now', { now })
      .andWhere('task.status != :done', { done: 'done' })
      .andWhere('task.deletedAt IS NULL')
      .getMany();

    if (overdue.length === 0) {
      ctx.logger.log('No overdue tasks found');
      return;
    }

    ctx.logger.warn(`Found ${overdue.length} overdue tasks`);

    const notificationEmail = ctx.config('app.notificationEmail');
    if (notificationEmail) {
      await ctx.sendEmail({
        to: notificationEmail,
        subject: `${overdue.length} tareas vencidas`,
        templateName: 'overdue-tasks',
        config: {
          subject: `${overdue.length} tareas vencidas`,
          count: overdue.length,
          overdueTasks: overdue.map((t: { id: string; title: string; dueDate: Date | string }) => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate instanceof Date ? t.dueDate.toISOString() : t.dueDate,
          })),
          lang: 'es',
        },
        text: `Hay ${overdue.length} tareas vencidas:\n\n${overdue.map((t: { title: string; dueDate: Date | string }) => `- ${t.title} (vencía: ${t.dueDate})`).join('\n')}`,
      });
      ctx.logger.log(`Overdue notification sent to ${notificationEmail}`);
    } else {
      ctx.logger.warn('No notification email configured — skipping email');
    }

    await ctx.logError(
      `${overdue.length} overdue tasks detected`,
      'spec-engine:tasks:overdue-detector',
      {
        count: overdue.length,
        taskIds: overdue.map((t: { id: string }) => t.id),
      },
    );
  } catch (err) {
    ctx.logger.error(`Overdue tasks check failed: ${(err as Error).message}`);
    throw err;
  }
}
