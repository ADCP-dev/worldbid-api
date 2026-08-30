<script setup lang="ts">
/**
 * Tasks page — single URL (/app/tasks) with Kanban / List toggle.
 *
 * Kanban: base <Kanban> component fed through useKanbanMapping
 * (SpecTask → KanbanTask). Status drops are optimistic; position reorder is
 * admin/manager only (PATCH /tasks/reorder, hook no-ops otherwise).
 * List: TaskGroupedList grouped by status with click → drawer.
 *
 * Click on any task opens TaskDetailDrawer (overview/notes/activity).
 * Stats strip: plain numbers from useTaskStatsQuery (no charts).
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { watchDebounced } from '@vueuse/core';
import { Plus, Search, BarChart3, RefreshCw, Inbox } from 'lucide-vue-next';
import Kanban from '@base/ui-app/components/kanban/Kanban.vue';
import TaskGroupedList from '@tasks/components/TaskGroupedList.vue';
import TaskDetailDrawer from '@tasks/components/TaskDetailDrawer.vue';
import {
  useDeleteTaskMutation,
  useReorderMutation,
  useTaskStatsQuery,
  useTaskUsersQuery,
  useTasksBoardQuery,
  useUpdateTaskMutation,
} from '@tasks/composables/useTasksQueries';
import {
  positionsFromOrder,
  taskColumnStyles,
  toKanbanStates,
  toKanbanTask,
  toUserLight,
} from '@tasks/composables/useKanbanMapping';
import { TASK_STATUSES } from '@tasks/types';
import type { KanbanTask } from '@base/ui-app/components/kanban/types';
import type { TaskStatus, UserLight } from '@tasks/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const { t } = useI18n();
const authStore = useAuthStore();

// ─── Role gating ─────────────────────────────────────────────────────────

/** POST /tasks and PATCH /tasks/reorder are gated to admin+manager. */
const canCreate = computed(() => authStore.isAdmin || authStore.isManager);

// ─── Board data ──────────────────────────────────────────────────────────

const searchInput = ref('');
const search = ref('');
watchDebounced(
  searchInput,
  (value) => {
    search.value = value;
  },
  { debounce: 300, maxWait: 1000 },
);

const boardQuery = useTasksBoardQuery(() => search.value);
const usersQuery = useTaskUsersQuery();
const statsQuery = useTaskStatsQuery();

const tasks = computed(() => boardQuery.data.value ?? []);
const users = computed<UserLight[]>(() => toUserLight(usersQuery.data.value ?? []));

// ─── Status filter chips (with counts) ───────────────────────────────────

const activeStatuses = ref<TaskStatus[]>([]);

function toggleStatus(status: TaskStatus) {
  activeStatuses.value = activeStatuses.value.includes(status)
    ? activeStatuses.value.filter((s) => s !== status)
    : [...activeStatuses.value, status];
}

const statusCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const task of tasks.value) {
    counts[task.status] = (counts[task.status] ?? 0) + 1;
  }
  return counts;
});

const filteredTasks = computed(() =>
  activeStatuses.value.length === 0
    ? tasks.value
    : tasks.value.filter((task) => activeStatuses.value.includes(task.status)),
);

// ─── Kanban mapping ──────────────────────────────────────────────────────

const view = ref<'kanban' | 'list'>('kanban');
// Title resolver passed per-state so labels track the active locale.
const states = computed(() =>
  toKanbanStates((status) => t(`ext.tasks.status.${status}`)),
);
const columnStyles = taskColumnStyles();

const kanbanTasks = computed<KanbanTask[]>(() =>
  filteredTasks.value.map((task) => toKanbanTask(task, users.value)),
);

// ─── Mutations + kanban handlers ─────────────────────────────────────────

const statusMutation = useUpdateTaskMutation();
const reorderMutation = useReorderMutation();
const deleteMutation = useDeleteTaskMutation();

function onTaskStateChange(payload: {
  taskId: string;
  newStateId: string;
  oldStateId: string;
}) {
  statusMutation.mutate(
    { id: Number(payload.taskId), data: { status: payload.newStateId as TaskStatus } },
    {
      onSuccess: () =>
        toast.success(
          t('ext.tasks.board.movedTo', {
            status: t(`ext.tasks.status.${payload.newStateId}`),
          }),
        ),
      onError: (err: unknown) =>
        toast.error(t('ext.tasks.board.moveFailed'), {
          description: errorMessage(err),
        }),
    },
  );
}

function onTaskOrderChange(payload: { taskId: string; stateId: string; index: number }) {
  // Position writes are admin/manager only; the hook no-ops for plain users,
  // so only the status change (already handled) reaches the API.
  const dragged = kanbanTasks.value.find((k) => k.id === payload.taskId);
  if (!dragged) return;
  const others = kanbanTasks.value
    .filter((k) => k.stateId === payload.stateId && k.id !== payload.taskId)
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
        (b.order ?? Number.MAX_SAFE_INTEGER),
    );
  const finalColumn = [
    ...others.slice(0, payload.index),
    dragged,
    ...others.slice(payload.index),
  ];
  reorderMutation.mutate(positionsFromOrder(finalColumn));
}

function onTaskTitleChange(payload: { taskId: string; title: string }) {
  statusMutation.mutate(
    { id: Number(payload.taskId), data: { title: payload.title } },
    {
      onError: (err: unknown) =>
        toast.error(t('ext.tasks.board.moveFailed'), {
          description: errorMessage(err),
        }),
    },
  );
}

function onTaskDelete(taskId: string) {
  // DELETE /tasks/:id is admin-only (backend enforces; UX hint here).
  if (!authStore.isAdmin) {
    toast.error(t('ext.tasks.board.noPermission'));
    return;
  }
  deleteMutation.mutate(Number(taskId), {
    onSuccess: () => toast.success(t('ext.tasks.board.deleted')),
    onError: (err: unknown) =>
      toast.error(t('ext.tasks.board.deleteFailed'), {
        description: errorMessage(err),
      }),
  });
}

function onKanbanCreate(stateId: string) {
  if (!canCreate.value) return;
  openCreate(stateId as TaskStatus);
}

function onListDrop(payload: { taskId: number; newStatus: TaskStatus }) {
  onTaskStateChange({
    taskId: String(payload.taskId),
    newStateId: payload.newStatus,
    oldStateId: '',
  });
}

// ─── Drawer state ────────────────────────────────────────────────────────

const drawerOpen = ref(false);
const drawerTaskId = ref<number | null>(null);
const drawerCreateStatus = ref<TaskStatus | null>(null);

/** Kanban emits string ids; the domain uses numeric ids. */
function onOpenTask(taskId: string) {
  openTask(Number(taskId));
}

function openTask(id: number) {
  drawerCreateStatus.value = null;
  drawerTaskId.value = id;
  drawerOpen.value = true;
}

function openCreate(status?: TaskStatus) {
  drawerTaskId.value = null;
  drawerCreateStatus.value = status ?? 'pending';
  drawerOpen.value = true;
}

function closeDrawer() {
  drawerOpen.value = false;
  drawerTaskId.value = null;
  drawerCreateStatus.value = null;
}

// ─── Stats strip (plain numbers, no charts) ──────────────────────────────

const statsCards = computed(() => {
  const byStatus = statsQuery.data.value?.byStatus ?? {};
  const total = TASK_STATUSES.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);
  const inProgress = byStatus.in_progress ?? 0;
  const done = byStatus.done ?? 0;
  const donePct = total > 0 ? Math.round((done / total) * 100) : 0;
  const overdue = statsQuery.data.value?.overdue?.length ?? 0;
  return { total, inProgress, donePct, overdue };
});
</script>

<template>
  <div class="p-4 md:p-6 h-full flex flex-col gap-4 overflow-hidden">
    <!-- ─── Header ─────────────────────────────────────────────── -->
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold">{{ t('ext.tasks.board.title') }}</h1>
        <NuxtLink
          to="/app/tasks-stats"
          class="btn btn-ghost btn-sm"
          :title="t('ext.tasks.board.statsLink')"
        >
          <BarChart3 class="w-4 h-4" />
        </NuxtLink>
      </div>

      <div class="flex items-center gap-2 flex-1 justify-end flex-wrap">
        <!-- Debounced search -->
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
          <input
            v-model="searchInput"
            type="text"
            :placeholder="t('ext.tasks.board.search')"
            class="input input-bordered input-sm w-64 pl-9"
          >
        </div>

        <!-- View toggle -->
        <div
          role="tablist"
          class="tabs tabs-boxed tabs-sm"
        >
          <button
            role="tab"
            class="tab"
            :class="{ 'tab-active': view === 'kanban' }"
            @click="view = 'kanban'"
          >{{ t('ext.tasks.board.viewBoard') }}</button>
          <button
            role="tab"
            class="tab"
            :class="{ 'tab-active': view === 'list' }"
            @click="view = 'list'"
          >{{ t('ext.tasks.board.viewList') }}</button>
        </div>

        <!-- New task — hidden for plain users (POST is admin+manager) -->
        <button
          v-if="canCreate"
          class="btn btn-primary btn-sm"
          @click="openCreate()"
        >
          <Plus class="w-4 h-4" />
          {{ t('ext.tasks.board.newTask') }}
        </button>
      </div>
    </div>

    <!-- ─── Status filter chips with counts ────────────────────── -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        class="btn btn-xs rounded-full"
        :class="activeStatuses.length === 0 ? 'btn-primary' : 'btn-ghost'"
        @click="activeStatuses = []"
      >
        {{ t('ext.tasks.board.allStatuses') }}
      </button>
      <button
        v-for="status in TASK_STATUSES"
        :key="status"
        class="btn btn-xs rounded-full"
        :class="activeStatuses.includes(status) ? 'btn-primary' : 'btn-ghost'"
        @click="toggleStatus(status)"
      >
        {{ t(`ext.tasks.status.${status}`) }}
        <span class="badge badge-xs ml-1">{{ statusCounts[status] ?? 0 }}</span>
      </button>
    </div>

    <!-- ─── Loading skeleton ───────────────────────────────────── -->
    <div
      v-if="boardQuery.isLoading.value && tasks.length === 0"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
    >
      <div
        v-for="i in 5"
        :key="i"
        class="card bg-base-100 border border-base-300 shadow-sm"
      >
        <div class="card-body gap-3 animate-pulse">
          <div class="h-4 w-2/3 bg-base-300 rounded" />
          <div class="h-16 w-full bg-base-200 rounded" />
          <div class="h-16 w-full bg-base-200 rounded" />
          <div class="h-8 w-1/3 bg-base-300 rounded" />
        </div>
      </div>
    </div>

    <!-- ─── Error + retry ──────────────────────────────────────── -->
    <div
      v-else-if="boardQuery.isError.value"
      class="flex-1 flex items-center justify-center"
    >
      <div class="card bg-base-100 border border-error/40 shadow-sm">
        <div class="card-body items-center text-center gap-3">
          <p class="text-sm text-error">{{ t('ext.tasks.board.error') }}</p>
          <button
            class="btn btn-sm btn-outline gap-2"
            @click="() => boardQuery.refetch()"
          >
            <RefreshCw class="w-4 h-4" />
            {{ t('ext.tasks.board.retry') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ─── Empty state ────────────────────────────────────────── -->
    <div
      v-else-if="tasks.length === 0"
      class="flex-1 flex items-center justify-center"
    >
      <div class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body items-center text-center gap-3 py-10">
          <Inbox class="w-10 h-10 text-base-content/30" />
          <p class="text-base-content/60 text-sm">
            {{
              search
                ? t('ext.tasks.board.emptySearch')
                : t('ext.tasks.board.empty')
            }}
          </p>
          <button
            v-if="canCreate && !search"
            class="btn btn-primary btn-sm"
            @click="openCreate()"
          >
            <Plus class="w-4 h-4" />
            {{ t('ext.tasks.board.newTask') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ─── Content ────────────────────────────────────────────── -->
    <template v-else>
      <!-- Stats strip: 4 plain-number cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body p-4 py-3">
            <p class="text-xs text-base-content/60">{{ t('ext.tasks.board.statsTotal') }}</p>
            <p class="text-2xl font-bold">{{ statsCards.total }}</p>
          </div>
        </div>
        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body p-4 py-3">
            <p class="text-xs text-base-content/60">{{ t('ext.tasks.board.statsInProgress') }}</p>
            <p class="text-2xl font-bold text-info">{{ statsCards.inProgress }}</p>
          </div>
        </div>
        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body p-4 py-3">
            <p class="text-xs text-base-content/60">{{ t('ext.tasks.board.statsDone') }}</p>
            <p class="text-2xl font-bold text-success">{{ statsCards.donePct }}%</p>
          </div>
        </div>
        <div class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body p-4 py-3">
            <p class="text-xs text-base-content/60">{{ t('ext.tasks.board.statsOverdue') }}</p>
            <p
              class="text-2xl font-bold"
              :class="statsCards.overdue > 0 ? 'text-error' : ''"
            >
              {{ statsCards.overdue }}
            </p>
          </div>
        </div>
      </div>

      <!-- Kanban view -->
      <div
        v-if="view === 'kanban'"
        class="flex-1 min-h-0"
      >
        <Kanban
          :tasks="kanbanTasks"
          :states="states"
          :state-config="columnStyles"
          :tag-config="{ maxVisible: 3 }"
          :show-toolbar="false"
          group="tasks-board"
          @update:task-state="onTaskStateChange"
          @update:task-order="onTaskOrderChange"
          @update-task-title="onTaskTitleChange"
          @delete-task="onTaskDelete"
          @click-task="onOpenTask"
          @create-task="onKanbanCreate"
        />
      </div>

      <!-- List view (grouped by status) -->
      <div
        v-else
        class="flex-1 overflow-y-auto"
      >
        <TaskGroupedList
          :tasks="filteredTasks"
          :users="users"
          :loading="boardQuery.isLoading.value"
          @drop="onListDrop"
          @click="openTask"
          @edit="openTask"
        />
      </div>
    </template>

    <!-- ─── Detail drawer (teleported) ─────────────────────────── -->
    <TaskDetailDrawer
      v-if="drawerOpen"
      :task-id="drawerTaskId"
      :create-status="drawerCreateStatus"
      @close="closeDrawer"
    />
  </div>
</template>
