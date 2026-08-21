/**
 * Stale Tasks Detector — Job Handler
 *
 * Runs every 60s (defined in tasks.spec.yaml).
 * Detects tasks that have been in "pending" status for more than 24 hours.
 * Triggers the stale-tasks notification via the notification system.
 */

import type { HookContext } from '@core/spec-engine/spec.types';

export default async function staleTasksDetector(
  ctx: HookContext,
): Promise<void> {
  ctx.logger.log('Checking for stale tasks...');

  const taskRepo = ctx.getRepository('task');

  // Find tasks pending for more than 24h
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const staleTasks = await taskRepo
      .createQueryBuilder('task')
      .where('task.status = :status', { status: 'pending' })
      .andWhere('task.createdAt < :threshold', { threshold: staleThreshold })
      .andWhere('task.deletedAt IS NULL')
      .getMany();

    if (staleTasks.length === 0) {
      ctx.logger.log('No stale tasks found');
      return;
    }

    ctx.logger.warn(`Found ${staleTasks.length} stale tasks (pending > 24h)`);

    // Send notification email to admin
    const notificationEmail = ctx.config('app.notificationEmail');
    if (notificationEmail) {
      await ctx.sendEmail({
        to: notificationEmail,
        subject: `${staleTasks.length} tareas pendientes sin actualizar`,
        templateName: 'stale-tasks',
        config: {
          subject: `${staleTasks.length} tareas pendientes sin actualizar`,
          count: staleTasks.length,
          staleTasks: staleTasks.map((t: { id: string; title: string; createdAt: Date | string }) => ({
            id: t.id,
            title: t.title,
            createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
          })),
          lang: 'es',
        },
        text: `Hay ${staleTasks.length} tareas que llevan más de 24 horas en estado "pending":\n\n${staleTasks.map((t: { title: string; createdAt: Date | string }) => `- ${t.title} (creada: ${t.createdAt})`).join('\n')}`,
      });
      ctx.logger.log(`Stale notification sent to ${notificationEmail}`);
    } else {
      ctx.logger.warn('No notification email configured — skipping email');
    }

    // Also log to error tracker for visibility
    await ctx.logError(
      `${staleTasks.length} stale tasks detected`,
      'spec-engine:tasks:stale-detector',
      { count: staleTasks.length, taskIds: staleTasks.map((t: any) => t.id) },
    );
  } catch (err) {
    ctx.logger.error(`Stale tasks check failed: ${(err as Error).message}`);
    throw err; // Let the job scheduler handle retries
  }
}
