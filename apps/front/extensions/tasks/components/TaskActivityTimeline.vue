<script setup lang="ts">
/**
 * TaskActivityTimeline — vertical timeline of task activities.
 * Each item: icon by action type, colored left border, description,
 * relative date, user avatar.
 */
import { computed } from 'vue';
import { Plus, Pencil, Trash2, MessageSquare } from 'lucide-vue-next';
import type { TaskActivity, UserLight } from '../types';

const props = defineProps<{
  activities: TaskActivity[];
  users: UserLight[];
  loading?: boolean;
}>();

const ACTION_META: Record<string, { icon: any; color: string; label: string }> = {
  created: { icon: Plus, color: 'border-success', label: 'Created' },
  updated: { icon: Pencil, color: 'border-info', label: 'Updated' },
  deleted: { icon: Trash2, color: 'border-error', label: 'Deleted' },
  commented: { icon: MessageSquare, color: 'border-secondary', label: 'Commented' },
};

function meta(action: string) {
  return ACTION_META[action] ?? { icon: Pencil, color: 'border-base-300', label: action };
}

const userMap = computed<Record<number, UserLight>>(() => {
  const m: Record<number, UserLight> = {};
  for (const u of props.users) m[u.id] = u;
  return m;
});

function initials(user: UserLight | undefined): string {
  if (!user) return '?';
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="loading" class="flex justify-center py-6">
      <span class="loading loading-spinner loading-sm text-primary" />
    </div>

    <div
      v-else-if="activities.length === 0"
      class="text-center py-8 text-base-content/40 text-sm"
    >
      No activity recorded
    </div>

    <ul v-else class="timeline timeline-vertical timeline-compact">
      <li v-for="activity in activities" :key="activity.id">
        <div class="timeline-middle">
          <component
            :is="meta(activity.action).icon"
            class="w-4 h-4"
            :class="meta(activity.action).color.replace('border-', 'text-')"
          />
        </div>
        <div
          class="timeline-end mb-4 pl-3 border-l-2 pb-2"
          :class="meta(activity.action).color"
        >
          <div class="flex items-center gap-2">
            <span class="badge badge-xs badge-ghost">{{ meta(activity.action).label }}</span>
            <span class="text-xs text-base-content/40">{{ timeAgo(activity.createdAt) }}</span>
            <div
              v-if="activity.userId && userMap[activity.userId]"
              class="avatar ml-auto"
            >
              <div class="w-5 h-5 rounded-full bg-neutral text-neutral-content text-[10px] flex items-center justify-center">
                {{ initials(userMap[activity.userId]) }}
              </div>
            </div>
          </div>
          <p class="text-sm text-base-content/70 mt-1">{{ activity.description }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>