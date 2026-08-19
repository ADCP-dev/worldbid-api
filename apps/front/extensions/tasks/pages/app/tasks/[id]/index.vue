<script setup lang="ts">
/**
 * Task detail page — tabbed view (Overview / Comments / Activity).
 * Header: breadcrumb + Edit / Delete / Back buttons.
 * Delete → confirm modal + deleteTask → redirect to /app/tasks.
 */
import { ref, computed, onMounted, watch } from 'vue';
import { toast } from 'vue-sonner';
import { Pencil, Trash2, ArrowLeft } from 'lucide-vue-next';
import type { Task, TaskActivity, TaskComment, TaskNote, UserLight, PaginatedResponse } from '@tasks/types';


definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const route = useRoute();
const tasksApi = useTasks();

const taskId = computed(() => Number(route.params.id));

const loading = ref(false);
const task = ref<Task | null>(null);
const users = ref<UserLight[]>([]);

// Tabs data
const comments = ref<TaskComment[]>([]);
const activities = ref<TaskActivity[]>([]);
const notes = ref<TaskNote[]>([]);
const commentsLoading = ref(false);
const activitiesLoading = ref(false);
const addingComment = ref(false);

// Delete modal
const showDeleteModal = ref(false);
const deleting = ref(false);


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

async function loadComments() {
  commentsLoading.value = true;
  try {
    const res: PaginatedResponse<TaskComment> | TaskComment[] =
      await tasksApi.getTaskComments(taskId.value, 1, 100);
    comments.value = Array.isArray(res) ? res : (res.data ?? []);
  } catch (err: unknown) {
    toast.error('Error loading comments', { description: errorMessage(err) });
  } finally {
    commentsLoading.value = false;
  }
}

async function loadActivities() {
  activitiesLoading.value = true;
  try {
    const res: PaginatedResponse<TaskActivity> | TaskActivity[] =
      await tasksApi.getTaskActivities(taskId.value, 1, 100);
    activities.value = Array.isArray(res) ? res : (res.data ?? []);
  } catch (err: unknown) {
    toast.error('Error loading activities', { description: errorMessage(err) });
  } finally {
    activitiesLoading.value = false;
  }
}

async function addComment(content: string) {
  addingComment.value = true;
  try {
    await tasksApi.createTaskComment({ taskId: taskId.value, content });
    toast.success('Comment added');
    await loadComments();
  } catch (err: unknown) {
    toast.error('Error adding comment', { description: errorMessage(err) });
  } finally {
    addingComment.value = false;
  }
}

async function confirmDelete() {
  deleting.value = true;
  try {
    await tasksApi.deleteTask(taskId.value);
    toast.success('Task deleted');
    navigateTo('/app/tasks');
  } catch (err: unknown) {
    toast.error('Error deleting task', { description: errorMessage(err) });
  } finally {
    deleting.value = false;
    showDeleteModal.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadTask(), loadUsers(), loadComments(), loadActivities()]);
});

// Reload when navigating between task ids (notes load on mount of TaskNotesList)
watch(taskId, () => {
  loadTask();
  loadComments();
  loadActivities();
});
</script>

<template>
  <div class="p-6 space-y-4 max-w-5xl mx-auto">
    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- Header / breadcrumb -->
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2 text-sm text-base-content/60">
          <NuxtLink to="/app/tasks" class="link link-hover">Tasks</NuxtLink>
          <span>/</span>
          <span class="text-base-content font-medium">#{{ taskId }}</span>
        </div>
        <div class="flex items-center gap-2">
          <NuxtLink :to="`/app/tasks/${taskId}/edit`" class="btn btn-sm btn-outline">
            <Pencil class="w-4 h-4" /> Edit
          </NuxtLink>
          <button class="btn btn-sm btn-outline btn-error" @click="showDeleteModal = true">
            <Trash2 class="w-4 h-4" /> Delete
          </button>
          <NuxtLink to="/app/tasks" class="btn btn-sm btn-ghost">
            <ArrowLeft class="w-4 h-4" /> Back
          </NuxtLink>
        </div>
      </div>

      <!-- Detail tabs -->
      <TaskDetailTabs
        :task="task"
        :comments="comments"
        :activities="activities"
        :notes="notes"
        :users="users"
        :comments-loading="commentsLoading"
        :activities-loading="activitiesLoading"
        :adding-comment="addingComment"
        @add-comment="addComment"
      />
    </template>

    <!-- Delete confirm modal -->
    <dialog :class="['modal', { 'modal-open': showDeleteModal }]">
      <div class="modal-box">
        <h3 class="text-lg font-bold">Delete task?</h3>
        <p class="py-4 text-sm text-base-content/70">
          Are you sure you want to delete "{{ task?.title }}"? This action cannot be undone.
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" :disabled="deleting" @click="showDeleteModal = false">Cancel</button>
          <button class="btn btn-error" :disabled="deleting" @click="confirmDelete">
            <span v-if="deleting" class="loading loading-spinner loading-xs" />
            Delete
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showDeleteModal = false">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>