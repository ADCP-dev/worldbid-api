/**
 * Composable for the Tasks extension.
 * Wraps all API calls to the backend tasks endpoints.
 * All endpoints require authentication — backend enforces role-based access.
 */

import type {
  ApiFetchOptions,
  BulkStatusPayload,
  PaginatedResponse,
  ReorderItem,
  StatsRange,
  Task,
  TaskActivity,
  TaskAttachment,
  TaskComment,
  TaskCommentPayload,
  TaskNote,
  TaskNotePayload,
  TaskPayload,
  TaskStatsResponse,
  UserLight,
} from '../types';

function useApi() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  const baseUrl = config.public.apiUrl as string;
  const apiPrefix = (config.public.apiPrefix as string) || '/api/v1';

  async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
    const headers: Record<string, string> = { ...options.headers };
    if (authStore.token) {
      headers.Authorization = `Bearer ${authStore.token}`;
    }
    const res = await $fetch<T>(`${baseUrl}${apiPrefix}${path}`, {
      method: options.method,
      query: options.query,
      body: options.body as BodyInit | Record<string, unknown> | null | undefined,
      headers,
    });
    return res as T;
  }

  return { apiFetch };
}

export function useTasks() {
  const { apiFetch } = useApi();

  // ─── Tasks ───────────────────────────────────────────────────────────

  async function getTasks(
    page = 1,
    limit = 20,
    search?: string,
    status?: string,
    priority?: string,
  ): Promise<PaginatedResponse<Task> | Task[]> {
    const query: Record<string, string | number | undefined> = { page, limit };
    if (search) query.search = search;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    return apiFetch<PaginatedResponse<Task> | Task[]>('/tasks', { query });
  }

  async function getTask(id: number | string): Promise<Task> {
    return apiFetch<Task>(`/tasks/${id}`);
  }

  async function createTask(data: TaskPayload): Promise<Task> {
    return apiFetch<Task>('/tasks', { method: 'POST', body: data });
  }

  async function updateTask(id: number | string, data: TaskPayload): Promise<Task> {
    return apiFetch<Task>(`/tasks/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteTask(id: number | string): Promise<void> {
    await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
  }

  // ─── Task Actions (stats / reorder / bulk-status) ────────────────────

  async function getStats(range: StatsRange = '30d'): Promise<TaskStatsResponse> {
    return apiFetch<TaskStatsResponse>('/tasks/stats', { query: { range } });
  }

  async function reorder(items: ReorderItem[]): Promise<{ success: true }> {
    return apiFetch<{ success: true }>('/tasks/reorder', {
      method: 'PATCH',
      body: { items },
    });
  }

  async function bulkStatus(payload: BulkStatusPayload): Promise<{ updated: number; skipped: number }> {
    return apiFetch<{ updated: number; skipped: number }>('/tasks/bulk-status', {
      method: 'PATCH',
      body: payload,
    });
  }

  // ─── Task Comments ───────────────────────────────────────────────────

  async function getTaskComments(
    taskId?: number | string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<TaskComment> | TaskComment[]> {
    const query: Record<string, string | number | undefined> = { page, limit };
    if (taskId) query.taskId = taskId;
    return apiFetch<PaginatedResponse<TaskComment> | TaskComment[]>('/task-comments', { query });
  }

  async function createTaskComment(data: TaskCommentPayload): Promise<TaskComment> {
    return apiFetch<TaskComment>('/task-comments', { method: 'POST', body: data });
  }

  // ─── Task Notes ──────────────────────────────────────────────────────

  async function getTaskNotes(
    taskId?: number | string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<TaskNote> | TaskNote[]> {
    const query: Record<string, string | number | undefined> = { page, limit };
    if (taskId) query.taskId = taskId;
    return apiFetch<PaginatedResponse<TaskNote> | TaskNote[]>('/task-notes', { query });
  }

  async function createTaskNote(data: TaskNotePayload): Promise<TaskNote> {
    return apiFetch<TaskNote>('/task-notes', { method: 'POST', body: data });
  }

  async function updateTaskNote(id: number | string, content: string): Promise<TaskNote> {
    return apiFetch<TaskNote>(`/task-notes/${id}`, { method: 'PATCH', body: { content } });
  }

  async function deleteTaskNote(id: number | string): Promise<void> {
    await apiFetch(`/task-notes/${id}`, { method: 'DELETE' });
  }

  // ─── Task Activities ──────────────────────────────────────────────────

  async function getTaskActivities(
    taskId?: number | string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<TaskActivity> | TaskActivity[]> {
    const query: Record<string, string | number | undefined> = { page, limit };
    if (taskId) query.taskId = taskId;
    return apiFetch<PaginatedResponse<TaskActivity> | TaskActivity[]>('/task-activities', { query });
  }

  // ─── Task Attachments ────────────────────────────────────────────────

  async function getTaskAttachments(
    taskId?: number | string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<TaskAttachment> | TaskAttachment[]> {
    const query: Record<string, string | number | undefined> = { page, limit };
    if (taskId) query.taskId = taskId;
    return apiFetch<PaginatedResponse<TaskAttachment> | TaskAttachment[]>('/task-attachments', { query });
  }

  // ─── Users (for assignee/reporter selects) ────────────────────────────
  // The /users endpoint may return either a bare array or a paginated
  // envelope { data: [...] }. Normalize to a plain array here so callers
  // can always treat the result as UserLight[].
  async function getUsers(): Promise<UserLight[]> {
    const res = await apiFetch<UserLight[] | PaginatedResponse<UserLight>>('/users');
    if (Array.isArray(res)) return res;
    return res.data ?? [];
  }

  return {
    // Tasks
    getTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    // Task actions
    getStats,
    reorder,
    bulkStatus,
    // Comments
    getTaskComments,
    createTaskComment,
    // Notes
    getTaskNotes,
    createTaskNote,
    updateTaskNote,
    deleteTaskNote,
    // Activities
    getTaskActivities,
    // Attachments
    getTaskAttachments,
    // Users
    getUsers,
  };
}