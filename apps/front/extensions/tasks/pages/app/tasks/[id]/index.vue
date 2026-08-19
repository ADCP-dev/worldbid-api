<script setup lang="ts">
/**
 * Task detail — a single full-page ficha (no tabs).
 *
 * Sections, top to bottom:
 *   1. Header: title, status/priority badges, assignee avatar, due date,
 *      estimate, created/updated. Buttons: Edit, Delete, Back.
 *   2. Description
 *   3. Metadata (tags, position, recurring, apiKey masked)
 *   4. Comments (list + add input, inline)
 *   5. Notes (list + add input, inline)
 *   6. Activity log (timeline, inline)
 *
 * Everything renders on one scrollable page separated by section headers.
 */
import { ref, computed, onMounted, watch } from 'vue';
import { toast } from 'vue-sonner';
import {
  Pencil, Trash2, ArrowLeft, Calendar, Clock, Repeat, Tag, KeyRound, User as UserIcon,
} from 'lucide-vue-next';
import type {
  Task, TaskActivity, TaskComment, UserLight, PaginatedResponse,
} from '@tasks/types';
import TaskStatusBadge from '@tasks/components/TaskStatusBadge.vue';
import TaskPriorityBadge from '@tasks/components/TaskPriorityBadge.vue';
import TaskCommentList from '@tasks/components/TaskCommentList.vue';
import TaskActivityTimeline from '@tasks/components/TaskActivityTimeline.vue';
import TaskNotesList from '@tasks/components/TaskNotesList.vue';


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

const comments = ref<TaskComment[]>([]);
const activities = ref<TaskActivity[]>([]);
const commentsLoading = ref(false);
const activitiesLoading = ref(false);
const addingComment = ref(false);

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

watch(taskId, () => {
  loadTask();
  loadComments();
  loadActivities();
});

// ─── Helpers ──────────────────────────────────────────────────────────
const userMap = computed<Record<number, UserLight>>(() => {
  const m: Record<number, UserLight> = {};
  for (const u of users.value) m[u.id] = u;
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
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDateTime(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const metadataEntries = computed<Array<[string, unknown]>>(() => {
  if (!task.value?.metadata) return [];
  return Object.entries(task.value.metadata as Record<string, unknown>);
});

const tagsList = computed<string[]>(() => {
  const t = task.value?.tags;
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  return [];
});

// apiKey masked — show only whether it exists + last 4 chars.
const apiKeyMasked = computed(() => {
  const k = task.value?.apiKey;
  if (!k) return null;
  if (k.length <= 4) return '••••';
  return `${'•'.repeat(Math.max(4, k.length - 4))}${k.slice(-4)}`);
});
</script>

<template>
  <div class="p-6 space-y-6 max-w-5xl mx-auto">
    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else-if="task">
      <!-- Top bar: breadcrumb + actions -->
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

      <!-- ─── Section 1: Header ─────────────────────────────────── -->
      <section class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body space-y-4">
          <div class="flex items-start gap-3 flex-wrap">
            <h1 class="text-2xl font-bold flex-1">{{ task.title }}</h1>
            <TaskStatusBadge :status="task.status" />
            <TaskPriorityBadge :priority="task.priority" />
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <!-- Assignee -->
            <div class="flex items-center gap-2">
              <div class="avatar">
                <div class="w-9 h-9 rounded-full bg-neutral text-neutral-content text-xs flex items-center justify-center">
                  {{ userInitials(task.assigneeId) }}
                </div>
              </div>
              <div class="min-w-0">
                <div class="text-xs text-base-content/50">Assignee</div>
                <div class="text-sm font-medium truncate">{{ userName(task.assigneeId) }}</div>
              </div>
            </div>

            <!-- Reporter -->
            <div class="flex items-center gap-2">
              <div class="avatar">
                <div class="w-9 h-9 rounded-full bg-neutral text-neutral-content text-xs flex items-center justify-center">
                  {{ userInitials(task.reporterId) }}
                </div>
              </div>
              <div class="min-w-0">
                <div class="text-xs text-base-content/50">Reporter</div>
                <div class="text-sm font-medium truncate">{{ userName(task.reporterId) }}</div>
              </div>
            </div>

            <!-- Due date -->
            <div class="flex items-center gap-2">
              <Calendar class="w-4 h-4 text-base-content/50" />
              <div>
                <div class="text-xs text-base-content/50">Due date</div>
                <div class="text-sm font-medium">{{ formatDate(task.dueDate) }}</div>
              </div>
            </div>

            <!-- Estimate -->
            <div class="flex items-center gap-2">
              <Clock class="w-4 h-4 text-base-content/50" />
              <div>
                <div class="text-xs text-base-content/50">Estimate</div>
                <div class="text-sm font-medium">{{ task.estimateHours != null ? `${task.estimateHours}h` : '—' }}</div>
              </div>
            </div>
          </div>

          <div class="flex justify-between text-xs text-base-content/40 pt-2 border-t border-base-300">
            <span>Created {{ formatDateTime(task.createdAt) }}</span>
            <span>Updated {{ formatDateTime(task.updatedAt) }}</span>
          </div>
        </div>
      </section>

      <!-- ─── Section 2: Description ─────────────────────────────── -->
      <section class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/60">Description</h2>
          <p v-if="task.description" class="text-base-content/80 whitespace-pre-wrap">
            {{ task.description }}
          </p>
          <p v-else class="text-base-content/40 italic">No description</p>
        </div>
      </section>

      <!-- ─── Section 3: Metadata ────────────────────────────────── -->
      <section class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body space-y-3">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/60">Metadata</h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <!-- Position -->
            <div class="flex items-center gap-2">
              <Tag class="w-4 h-4 text-base-content/50" />
              <span class="text-xs text-base-content/50">Position</span>
              <span class="text-sm font-medium ml-auto">{{ task.position ?? 0 }}</span>
            </div>

            <!-- Recurring -->
            <div class="flex items-center gap-2">
              <Repeat class="w-4 h-4 text-base-content/50" />
              <span class="text-xs text-base-content/50">Recurring</span>
              <span class="text-sm font-medium ml-auto">
                {{ task.isRecurring ? (task.recurrenceRule || 'Yes') : 'No' }}
              </span>
            </div>

            <!-- API key (masked) -->
            <div class="flex items-center gap-2">
              <KeyRound class="w-4 h-4 text-base-content/50" />
              <span class="text-xs text-base-content/50">API key</span>
              <span class="text-sm font-mono ml-auto" :class="apiKeyMasked ? '' : 'text-base-content/30'">
                {{ apiKeyMasked ?? '—' }}
              </span>
            </div>

            <!-- Assignee id fallback -->
            <div class="flex items-center gap-2">
              <UserIcon class="w-4 h-4 text-base-content/50" />
              <span class="text-xs text-base-content/50">Assignee ID</span>
              <span class="text-sm font-medium ml-auto">{{ task.assigneeId ?? '—' }}</span>
            </div>
          </div>

          <!-- Tags -->
          <div v-if="tagsList.length > 0" class="pt-2 border-t border-base-300">
            <div class="text-xs text-base-content/50 mb-2">Tags</div>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="tag in tagsList"
                :key="tag"
                class="badge badge-sm badge-ghost"
              >{{ tag }}</span>
            </div>
          </div>

          <!-- Free-form metadata -->
          <div v-if="metadataEntries.length > 0" class="pt-2 border-t border-base-300">
            <div class="text-xs text-base-content/50 mb-2">Custom metadata</div>
            <div class="bg-base-200 rounded-lg p-3 space-y-1">
              <div v-for="[k, v] in metadataEntries" :key="k" class="text-sm flex gap-2">
                <span class="font-mono text-base-content/60">{{ k }}:</span>
                <span class="text-base-content/80">{{ String(v) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ─── Section 4: Comments ────────────────────────────────── -->
      <section class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/60 mb-2">
            Comments
            <span v-if="comments.length" class="badge badge-xs badge-ghost ml-1">{{ comments.length }}</span>
          </h2>
          <TaskCommentList
            :comments="comments"
            :users="users"
            :task-id="taskId"
            :loading="commentsLoading"
            @add="addComment"
          />
        </div>
      </section>

      <!-- ─── Section 5: Notes ───────────────────────────────────── -->
      <section class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/60 mb-2">Notes</h2>
          <TaskNotesList :task-id="taskId" :users="users" />
        </div>
      </section>

      <!-- ─── Section 6: Activity ────────────────────────────────── -->
      <section class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/60 mb-2">
            Activity
            <span v-if="activities.length" class="badge badge-xs badge-ghost ml-1">{{ activities.length }}</span>
          </h2>
          <TaskActivityTimeline
            :activities="activities"
            :users="users"
            :loading="activitiesLoading"
          />
        </div>
      </section>
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