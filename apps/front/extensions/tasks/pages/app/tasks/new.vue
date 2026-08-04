<script setup lang="ts">
/**
 * New Task page — uses TaskForm (3-step stepper).
 * On success → redirect to /app/tasks/[id].
 * Reads ?status= query to pre-select status (kanban "+" button).
 */
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import type { Task, TaskPayload, UserLight } from '@tasks/types';


definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const route = useRoute();
const tasksApi = useTasks();

const saving = ref(false);
const users = ref<UserLight[]>([]);

const initialStatus = computed(() => (route.query.status as string) || '');

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
    const task: Task = await tasksApi.createTask(payload);
    toast.success('Task created');
    navigateTo(`/app/tasks/${task.id}`);
  } catch (err: unknown) {
    toast.error('Error creating task', { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

function onCancel() {
  navigateTo('/app/tasks');
}

onMounted(loadUsers);
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto space-y-4">
    <div class="flex items-center gap-3">
      <NuxtLink to="/app/tasks" class="btn btn-ghost btn-sm">← Back</NuxtLink>
      <h1 class="text-2xl font-bold">New Task</h1>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <TaskForm
          :users="users"
          :saving="saving"
          :initial-status="initialStatus"
          @submit="onSubmit"
          @cancel="onCancel"
        />
      </div>
    </div>
  </div>
</template>