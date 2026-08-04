<script setup lang="ts">
/**
 * Tasks Kanban board — the main /app/tasks page.
 * 5 columns (pending, in_progress, review, done, blocked) with drag & drop.
 * Cross-column drop → updateTask(id, { status }) (pessimistic: refetch on
 * success, revert on fail).
 */
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import { Plus, Search } from 'lucide-vue-next';
import type { Task, TaskStatus, UserLight, PaginatedResponse } from '@tasks/types';


definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const tasksApi = useTasks();

const loading = ref(false);
const tasks = ref<Task[]>([]);
const users = ref<UserLight[]>([]);
const search = ref('');
const pendingStatus = ref<TaskStatus | ''>('');

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function loadTasks() {
  loading.value = true;
  try {
    const res: PaginatedResponse<Task> | Task[] = await tasksApi.getTasks(
      1,
      100,
      search.value || undefined,
    );
    tasks.value = Array.isArray(res) ? res : (res.data ?? []);
  } catch (err: unknown) {
    toast.error('Error loading tasks', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

async function loadUsers() {
  try {
    users.value = await tasksApi.getUsers();
  } catch (err: unknown) {
    toast.error('Error loading users', { description: errorMessage(err) });
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadTasks(), 300);
}

async function onDrop({ taskId, newStatus }: { taskId: number; newStatus: TaskStatus }) {
  // Find the task + remember its old status for revert
  const task = tasks.value.find((t) => t.id === taskId);
  if (!task) return;
  const oldStatus = task.status;

  // Optimistic UI update
  task.status = newStatus;

  try {
    await tasksApi.updateTask(taskId, { status: newStatus });
    toast.success(`Moved to ${newStatus.replace('_', ' ')}`);
  } catch (err: unknown) {
    // Revert
    task.status = oldStatus;
    toast.error('Failed to move task', { description: errorMessage(err) });
    // Force re-sync board from canonical state
    await loadTasks();
  }
}

function onAdd(status: TaskStatus) {
  navigateTo({ path: '/app/tasks/new', query: { status } });
}

onMounted(async () => {
  await Promise.all([loadTasks(), loadUsers()]);
});
</script>

<template>
  <div class="p-4 md:p-6 space-y-4 h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <h1 class="text-2xl font-bold">Tasks</h1>
      <div class="flex items-center gap-2 flex-1 justify-end">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
          <input
            v-model="search"
            type="text"
            placeholder="Search tasks…"
            class="input input-bordered input-sm w-64 pl-9"
            @input="onSearchInput"
          >
        </div>
        <button
          class="btn btn-primary btn-sm"
          @click="navigateTo('/app/tasks/new')"
        >
          <Plus class="w-4 h-4" /> New Task
        </button>
      </div>
    </div>

    <!-- Kanban board -->
    <TaskKanbanBoard
      :tasks="tasks"
      :users="users"
      :loading="loading"
      @drop="onDrop"
      @click="(id: number) => navigateTo(`/app/tasks/${id}`)"
      @edit="(id: number) => navigateTo(`/app/tasks/${id}/edit`)"
      @add="onAdd"
    />
  </div>
</template>