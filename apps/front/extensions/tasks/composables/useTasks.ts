/**
 * Composable for the Tasks extension.
 * Wraps all API calls to the backend tasks endpoints.
 * All endpoints require authentication — backend enforces role-based access.
 */

import type {
  ApiFetchOptions,
  PaginatedResponse,
  Task,
  TaskActivity,
  TaskAttachment,
  TaskComment,
  TaskCommentPayload,
  TaskPayload,
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
    return apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' });
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

  async function getUsers(): Promise<UserLight[]> {
    return apiFetch<UserLight[]>('/users');
  }

  return {
    // Tasks
    getTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    // Comments
    getTaskComments,
    createTaskComment,
    // Activities
    getTaskActivities,
    // Attachments
    getTaskAttachments,
    // Users
    getUsers,
  };
}