/**
 * Stale Tasks Detector — Job Handler
 *
 * Runs on interval (defined in tasks.spec.yaml).
 * Detects tasks that have been in "pending" status for more than 24 hours
 * and logs a warning. In production, this would fire a webhook or notification.
 */

import type { JobContext } from '@core/spec-engine/spec-job-runner';

// The handler receives a context with logger + spec metadata.
// In production, it would have access to the repository via DI.
// For the spike, we use a simple log + console.warn pattern.

export default async function staleTasksDetector(ctx: JobContext): Promise<void> {
  ctx.logger.log('Checking for stale tasks...');

  // In the full implementation, we would:
  // 1. Query the task repository for tasks where status = 'pending'
  //    AND createdAt < now - 24h
  // 2. For each stale task, fire a webhook or notification
  //
  // For the spike, we simulate the check:
  const staleThreshold = 24 * 60 * 60 * 1000; // 24h in ms
  const staleTime = new Date(Date.now() - staleThreshold);

  // This would be a repository query:
  //   const staleTasks = await repo.find({
  //     where: { status: 'pending', createdAt: LessThan(staleTime) },
  //   });
  //
  // if (staleTasks.length > 0) {
  //   ctx.logger.warn(`Found ${staleTasks.length} stale tasks (pending > 24h)`);
  //   // Fire webhook to external system
  //   await fetch(`${baseUrl}/api/v1/tasks/webhooks/stale`, { ... });
  // }

  ctx.logger.log(
    `Stale check complete (threshold: ${staleTime.toISOString()}). No stale tasks found in this run.`,
  );
}