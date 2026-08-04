<script setup lang="ts">
/**
 * Task Activities page — full timeline of all task activities.
 * Uses TaskActivityTimeline component (vertical timeline with icons).
 */
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import type { TaskActivity, UserLight, PaginatedResponse } from '@tasks/types';


definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const tasksApi = useTasks();

const loading = ref(false);
const activities = ref<TaskActivity[]>([]);
const users = ref<UserLight[]>([]);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function loadActivities() {
  loading.value = true;
  try {
    const res: PaginatedResponse<TaskActivity> | TaskActivity[] =
      await tasksApi.getTaskActivities(undefined, 1, 100);
    activities.value = Array.isArray(res) ? res : (res.data ?? []);
  } catch (err: unknown) {
    toast.error('Error loading activities', { description: errorMessage(err) });
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

onMounted(async () => {
  await Promise.all([loadActivities(), loadUsers()]);
});
</script>

<template>
  <div class="p-6 space-y-4 max-w-3xl mx-auto">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Task Activity</h1>
      <NuxtLink to="/app/tasks" class="btn btn-ghost btn-sm">← Board</NuxtLink>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <TaskActivityTimeline
          :activities="activities"
          :users="users"
          :loading="loading"
        />
      </div>
    </div>
  </div>
</template>