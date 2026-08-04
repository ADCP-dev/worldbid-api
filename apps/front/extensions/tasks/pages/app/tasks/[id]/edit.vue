<script setup lang="ts">
/**
 * Edit Task page — uses TaskForm with the existing task loaded.
 * On success → redirect to /app/tasks/[id].
 */
import { ref, computed, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import type { Task, TaskPayload, UserLight } from '@tasks/types';


definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const route = useRoute();
const tasksApi = useTasks();

const taskId = computed(() => Number(route.params.id));

const loading = ref(false);
const saving = ref(false);
const task = ref<Task | null>(null);
const users = ref<UserLight[]>([]);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function loadTask() {
  loading.value = true;
  try {
    task.value = await tasksApi.getTask(taskId.value);
  } catch (err: unknown) {
    toast.error('Error loading task', { description: errorMessage(err) });
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

async function onSubmit(payload: TaskPayload) {
  saving.value = true;
  try {
    await tasksApi.updateTask(taskId.value, payload);
    toast.success('Task updated');
    navigateTo(`/app/tasks/${taskId.value}`);
  } catch (err: unknown) {
    toast.error('Error updating task', { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadTask(), loadUsers()]);
});
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto space-y-4">
    <div class="flex items-center gap-3">
      <NuxtLink :to="`/app/tasks/${taskId}`" class="btn btn-ghost btn-sm">← Back</NuxtLink>
      <h1 class="text-2xl font-bold">Edit Task</h1>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <div v-else class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <TaskForm
          :task="task"
          :users="users"
          :saving="saving"
          @submit="onSubmit"
          @cancel="() => navigateTo(`/app/tasks/${taskId}`)"
        />
      </div>
    </div>
  </div>
</template>