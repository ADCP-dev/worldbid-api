/**
 * useTasksQueries — TanStack Query hooks for the Tasks extension.
 *
 * Pattern mirrors useCrm.ts / useUsers.ts: one query/mutation hook per
 * operation, all HTTP through the global useApi() (auth + 401 refresh).
 *
 * Cache keys are namespaced under ['tasks', ...]. Every mutation invalidates
 * the board + stats; status/position changes apply optimistic updates with
 * rollback on error.
 *
 * Backend contract (apps/back/src/extensions/tasks/*.spec.yaml):
 *   - GET    /tasks              (admin, user, manager — rowLevel: user/manager see assigneeId == self)
 *   - GET    /tasks/:id          (list endpoint caps `limit` at 100 → board uses 100)
 *   - POST   /tasks              (admin, manager)
 *   - PATCH  /tasks/:id          (admin, user, manager; `position` field admin/manager only)
 *   - DELETE /tasks/:id          (admin, soft delete)
 *   - GET    /tasks/stats        (admin, user, manager)
 *   - PATCH  /tasks/reorder      (admin, manager)  { items: [{ id, position }] }
 *   - PATCH  /tasks/bulk-status  (admin, user, manager)  { ids, status }
 *   - GET/POST /task-notes       (rowLevel: authorId == me for user/manager)
 *   - GET    /task-activities    (rowLevel: userId == me for user role)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { computed, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useAuthStore } from '@base/auth/stores/auth.store';
import type { PaginatedResponse, ReorderItem, SpecTask, TaskActivity, TaskNote, TaskStatsResponse } from '../types';

export const tasksKeys = {
  all: ['tasks'] as const,
  board: (search: string) => ['tasks', 'board', search] as const,
  task: (id: number | string) => ['tasks', 'task', id] as const,
  notes: (taskId: number | string) => ['tasks', 'notes', taskId] as const,
  activities: (taskId: number | string) => ['tasks', 'activities', taskId] as const,
  stats: ['tasks', 'stats'] as const,
};

/** Spec list envelope: { data, meta: { total, page, limit } }. Normalizes bare arrays too. */
function asList<T>(res: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(res) ? res : (res.data ?? []);
}

function apiErrorStatus(err: unknown): number | null {
  if (err && typeof err === 'object' && 'status' in err) {
    const s = (err as { status?: unknown }).status;
    if (typeof s === 'number') return s;
  }
  return null;
}

// ─── Queries ─────────────────────────────────────────────────────────────

export function useTasksBoardQuery(search: MaybeRefOrGetter<string> = () => '') {
  const api = useApi();
  const searchRef = computed(() => toValue(search) ?? '');
  return useQuery({
    queryKey: computed(() => tasksKeys.board(searchRef.value)),
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<SpecTask> | SpecTask[]>('/tasks', {
        query: {
          page: 1,
          limit: 100,
          search: searchRef.value || undefined,
          sort: 'position',
        },
      });
      return asList(res);
    },
  });
}

export function useTaskQuery(id: MaybeRefOrGetter<number | string | undefined>) {
  const api = useApi();
  return useQuery({
    queryKey: computed(() => tasksKeys.task(toValue(id) ?? 0)),
    enabled: computed(() => toValue(id) !== undefined),
    queryFn: () => api.get<SpecTask>(`/tasks/${toValue(id)}`),
  });
}

/**
 * Canonical assignee directory — resolved client-side because the tasks spec
 * does not declare `includeable` on assigneeId/reporterId (so GET /tasks
 * never embeds user objects; ids are plain numbers coming back).
 */
export function useTaskUsersQuery(enabled?: MaybeRefOrGetter<boolean>) {
  const api = useApi();
  return useQuery({
    queryKey: ['tasks', 'users'] as const,
    enabled: computed(() => toValue(enabled) ?? true),
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<{ id: number; firstName: string | null; lastName: string | null; email: string; role?: { name?: string } | null; photo?: { path?: string } | null }> | Array<{ id: number; firstName: string | null; lastName: string | null; email: string; role?: { name?: string } | null; photo?: { path?: string } | null }>>('/users', {
        query: { limit: 100 },
      });
      return asList(res);
    },
  });
}

export function useTaskStatsQuery() {
  const api = useApi();
  return useQuery({
    queryKey: tasksKeys.stats,
    queryFn: () => api.get<TaskStatsResponse>('/tasks/stats', { query: { range: '30d' } }),
  });
}

export function useTaskNotesQuery(taskId: MaybeRefOrGetter<number | string | undefined>) {
  const api = useApi();
  return useQuery({
    queryKey: computed(() => tasksKeys.notes(toValue(taskId) ?? 0)),
    enabled: computed(() => toValue(taskId) !== undefined),
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<TaskNote> | TaskNote[]>('/task-notes', {
        query: { taskId: toValue(taskId), limit: 50 },
      });
      // Backend sorts? Not guaranteed — newest first for the drawer.
      return asList(res).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
  });
}

export function useTaskActivitiesQuery(taskId: MaybeRefOrGetter<number | string | undefined>) {
  const api = useApi();
  return useQuery({
    queryKey: computed(() => tasksKeys.activities(toValue(taskId) ?? 0)),
    enabled: computed(() => toValue(taskId) !== undefined),
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<TaskActivity> | TaskActivity[]>('/task-activities', {
        query: { taskId: toValue(taskId), limit: 50 },
      });
      return asList(res).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────

function useInvalidateTasks() {
  const qc = useQueryClient();
  return (taskId?: number | string) => {
    void qc.invalidateQueries({ queryKey: tasksKeys.all });
    if (taskId !== undefined) {
      void qc.invalidateQueries({ queryKey: tasksKeys.task(taskId) });
    }
  };
}

/**
 * Optimistic board helper: patch one task inside every cached board list
 * (any search variant). Returns a rollback closure restoring snapshots.
 */
function useOptimisticBoardPatch() {
  const qc = useQueryClient();
  return (taskId: number, patch: Partial<SpecTask>): (() => void) => {
    const snapshots = qc.getQueriesData<PaginatedResponse<SpecTask> | SpecTask[]>({
      queryKey: ['tasks', 'board'],
    });
    qc.setQueriesData<PaginatedResponse<SpecTask> | SpecTask[]>(
      { queryKey: ['tasks', 'board'] },
      (old) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((t) => (t.id === taskId ? { ...t, ...patch } : t));
        }
        return {
          ...old,
          data: (old.data ?? []).map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
        };
      },
    );
    return () => {
      for (const [key, snap] of snapshots) {
        qc.setQueryData(key, snap);
      }
    };
  };
}

export function useUpdateTaskMutation() {
  const api = useApi();
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SpecTask> }) =>
      api.patch<SpecTask>(`/tasks/${id}`, data),
    onMutate: async ({ id, data }) => {
      // Optimistic only for fields the board renders (status / position).
      const boardFields: Partial<SpecTask> = {};
      if (data.status !== undefined) boardFields.status = data.status;
      if (data.position !== undefined) boardFields.position = data.position;
      let rollback: (() => void) | null = null;
      if (Object.keys(boardFields).length > 0) {
        rollback = useOptimisticBoardPatch()(id, boardFields);
      }
      return { rollback };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.rollback?.();
    },
    onSettled: (_data, _error, vars) => {
      invalidate(vars.id);
    },
  });
}

export function useCreateTaskMutation() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SpecTask>) => api.post<SpecTask>('/tasks', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tasksKeys.all });
    },
  });
}

export function useDeleteTaskMutation() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/tasks/${id}`),
    onMutate: async (id) => {
      // Snapshot every cached board list (per query key) before mutating.
      const snapshots = qc.getQueriesData<
        PaginatedResponse<SpecTask> | SpecTask[]
      >({ queryKey: ['tasks', 'board'] });
      qc.setQueriesData<PaginatedResponse<SpecTask> | SpecTask[]>(
        { queryKey: ['tasks', 'board'] },
        (old) => {
          if (!old) return old;
          const remove = (t: SpecTask) => t.id !== id;
          return Array.isArray(old)
            ? old.filter(remove)
            : { ...old, data: (old.data ?? []).filter(remove) };
        },
      );
      return () => {
        for (const [key, snap] of snapshots) {
          qc.setQueryData(key, snap);
        }
      };
    },
    onError: (_err, _id, rollback) => {
      if (typeof rollback === 'function') rollback();
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: tasksKeys.all });
    },
  });
}

/** Is the current user allowed to PATCH /tasks/reorder? (admin | manager) */
export function useCanReorder(): boolean {
  const auth = useAuthStore();
  return computed(() => auth.isAdmin || auth.isManager).value;
}

/**
 * Reorder mutation — PATCH /tasks/reorder. The backend action is gated to
 * [admin, manager]. Callers should already skip for plain users; this hook
 * additionally no-ops (resolves immediately) when the caller isn't allowed,
 * so a stray drag never spams 403 toasts.
 */
export function useReorderMutation() {
  const api = useApi();
  const qc = useQueryClient();
  const auth = useAuthStore();
  const canReorder = computed(() => auth.isAdmin || auth.isManager);
  return useMutation({
    mutationFn: async (items: ReorderItem[]) => {
      if (!canReorder.value || items.length === 0) return { success: true as const };
      return api.patch<{ success: true }>('/tasks/reorder', { items });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', 'board'] });
    },
  });
}

export function useBulkStatusMutation() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { ids: number[]; status: SpecTask['status'] }) =>
      api.patch<{ updated: number; skipped: number }>('/tasks/bulk-status', payload),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: tasksKeys.all });
    },
  });
}

export function useCreateNoteMutation() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: number; content: string }) =>
      api.post<TaskNote>('/task-notes', { taskId, content }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: tasksKeys.notes(vars.taskId) });
    },
  });
}

export { asList as tasksAsList, apiErrorStatus };