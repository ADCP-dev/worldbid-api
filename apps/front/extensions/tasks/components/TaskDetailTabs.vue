<script setup lang="ts">
/**
 * TaskDetailTabs — tabbed detail view for a single Task.
 * Tab 1 Overview: full data (title, description, status/priority badges,
 *   assignee, due date, estimate, metadata, recurrence).
 * Tab 2 Comments: TaskCommentList (list + add input).
 * Tab 3 Activity: TaskActivityTimeline.
 */
import { ref, computed, watch } from 'vue';
import { Calendar, Clock, Repeat, User as UserIcon, Tag } from 'lucide-vue-next';
import type { Task, TaskActivity, TaskComment, UserLight } from '../types';
import TaskStatusBadge from './TaskStatusBadge.vue';
import TaskPriorityBadge from './TaskPriorityBadge.vue';
import TaskCommentList from './TaskCommentList.vue';
import TaskActivityTimeline from './TaskActivityTimeline.vue';

const props = defineProps<{
  task: Task | null;
  comments: TaskComment[];
  activities: TaskActivity[];
  users: UserLight[];
  commentsLoading?: boolean;
  activitiesLoading?: boolean;
  addingComment?: boolean;
}>();

const emit = defineEmits<{
  (e: 'add-comment', content: string): void;
}>();

const activeTab = ref<'overview' | 'comments' | 'activity'>('overview');

const userMap = computed<Record<number, UserLight>>(() => {
  const m: Record<number, UserLight> = {};
  for (const u of props.users) m[u.id] = u;
  return m;
});

function userName(id?: number | null): string {
  if (!id) return 'Unassigned';
  const u = userMap.value[id];
  return u ? `${u.firstName} ${u.lastName}`.trim() : `User #${id}`;
}

function userInitials(id?: number | null): string {
  if (!id) return '?';
  const u = userMap.value[id];
  if (!u) return '?';
  return `${u.firstName} ${u.lastName}`
    .trim()
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const metadataEntries = computed<Array<[string, unknown]>>(() => {
  if (!props.task?.metadata) return [];
  return Object.entries(props.task.metadata as Record<string, unknown>);
});
</script>

<template>
  <div class="space-y-4">
    <!-- Tabs -->
    <div role="tablist" class="tabs tabs-boxed">
      <button
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'overview' }"
        @click="activeTab = 'overview'"
      >Overview</button>
      <button
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'comments' }"
        @click="activeTab = 'comments'"
      >Comments <span v-if="comments.length" class="badge badge-xs badge-ghost ml-1">{{ comments.length }}</span></button>
      <button
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'activity' }"
        @click="activeTab = 'activity'"
      >Activity</button>
    </div>

    <!-- Tab: Overview -->
    <div v-if="activeTab === 'overview'" class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body space-y-4">
        <div class="flex items-start gap-3 flex-wrap">
          <h2 class="text-xl font-bold flex-1">{{ task?.title }}</h2>
          <TaskStatusBadge v-if="task" :status="task.status" />
          <TaskPriorityBadge v-if="task" :priority="task.priority" />
        </div>

        <p v-if="task?.description" class="text-base-content/80 whitespace-pre-wrap">
          {{ task.description }}
        </p>
        <p v-else class="text-base-content/40 italic">No description</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-base-300">
          <!-- Assignee -->
          <div class="flex items-center gap-2">
            <div class="avatar">
              <div class="w-8 h-8 rounded-full bg-neutral text-neutral-content text-xs flex items-center justify-center">
                {{ userInitials(task?.assigneeId) }}
              </div>
            </div>
            <div>
              <div class="text-xs text-base-content/50">Assignee</div>
              <div class="text-sm font-medium">{{ userName(task?.assigneeId) }}</div>
            </div>
          </div>

          <!-- Reporter -->
          <div class="flex items-center gap-2">
            <div class="avatar">
              <div class="w-8 h-8 rounded-full bg-neutral text-neutral-content text-xs flex items-center justify-center">
                {{ userInitials(task?.reporterId) }}
              </div>
            </div>
            <div>
              <div class="text-xs text-base-content/50">Reporter</div>
              <div class="text-sm font-medium">{{ userName(task?.reporterId) }}</div>
            </div>
          </div>

          <!-- Due date -->
          <div class="flex items-center gap-2">
            <Calendar class="w-4 h-4 text-base-content/50" />
            <div>
              <div class="text-xs text-base-content/50">Due date</div>
              <div class="text-sm font-medium">{{ formatDate(task?.dueDate) }}</div>
            </div>
          </div>

          <!-- Estimate -->
          <div class="flex items-center gap-2">
            <Clock class="w-4 h-4 text-base-content/50" />
            <div>
              <div class="text-xs text-base-content/50">Estimate</div>
              <div class="text-sm font-medium">{{ task?.estimateHours != null ? `${task.estimateHours}h` : '—' }}</div>
            </div>
          </div>

          <!-- Position -->
          <div class="flex items-center gap-2">
            <Tag class="w-4 h-4 text-base-content/50" />
            <div>
              <div class="text-xs text-base-content/50">Position</div>
              <div class="text-sm font-medium">{{ task?.position ?? 0 }}</div>
            </div>
          </div>

          <!-- Recurrence -->
          <div v-if="task?.isRecurring" class="flex items-center gap-2">
            <Repeat class="w-4 h-4 text-base-content/50" />
            <div>
              <div class="text-xs text-base-content/50">Recurrence</div>
              <div class="text-sm font-medium">{{ task.recurrenceRule || 'Recurring' }}</div>
            </div>
          </div>
        </div>

        <!-- Metadata -->
        <div v-if="metadataEntries.length > 0" class="pt-4 border-t border-base-300">
          <div class="text-xs text-base-content/50 mb-2">Metadata</div>
          <div class="bg-base-200 rounded-lg p-3 space-y-1">
            <div v-for="[k, v] in metadataEntries" :key="k" class="text-sm flex gap-2">
              <span class="font-mono text-base-content/60">{{ k }}:</span>
              <span class="text-base-content/80">{{ String(v) }}</span>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-base-300 flex justify-between text-xs text-base-content/40">
          <span>Created {{ formatDateTime(task?.createdAt) }}</span>
          <span>Updated {{ formatDateTime(task?.updatedAt) }}</span>
        </div>
      </div>
    </div>

    <!-- Tab: Comments -->
    <div v-else-if="activeTab === 'comments'" class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <TaskCommentList
          :comments="comments"
          :users="users"
          :task-id="task?.id ?? 0"
          :loading="commentsLoading"
          @add="(c: string) => emit('add-comment', c)"
        />
      </div>
    </div>

    <!-- Tab: Activity -->
    <div v-else class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <TaskActivityTimeline
          :activities="activities"
          :users="users"
          :loading="activitiesLoading"
        />
      </div>
    </div>
  </div>
</template>