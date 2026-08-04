/**
 * Task Before Create Hook
 *
 * Auto-assigns admin user and sets due date when priority is urgent.
 * This is the "escape hatch" — custom logic that can't be declarative.
 */

import type { HookContext } from '@core/spec-engine/spec.types';

export default async function taskBeforeCreate(
  data: Record<string, unknown>,
  ctx: HookContext,
): Promise<{
  data: Record<string, unknown>;
  proceed: boolean;
  error?: string;
}> {
  ctx.logger.log('Running beforeCreate hook for task');

  // Auto-assign admin for urgent tasks without assignee
  if (data.priority === 'urgent' && !data.assigneeId) {
    ctx.trace.add('beforeCreate', {
      decision: 'auto-assign-admin',
      reason: 'priority=urgent and no assignee specified',
    });

    // In a real implementation, we'd query the User repository.
    // For the spike, we hardcode admin id = 1.
    data.assigneeId = 1;

    // Set due date to 24h from now if not specified
    if (!data.dueDate) {
      data.dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
  }

  // Validate title doesn't contain banned words
  if (typeof data.title === 'string') {
    const banned = ['TODO', 'FIXME'];
    const upper = data.title.toUpperCase();
    for (const word of banned) {
      if (upper.includes(word)) {
        ctx.trace.add('beforeCreate', {
          decision: 'abort',
          reason: `Title contains banned word: ${word}`,
        });
        return {
          data,
          proceed: false,
          error: `Title cannot contain "${word}"`,
        };
      }
    }
  }

  return { data, proceed: true };
}
