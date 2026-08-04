/**
 * Shared TypeScript interfaces for the Tasks frontend extension.
 * Mirrors backend DTOs and entities in apps/back/src/extensions/tasks/.
 */

// ─── API fetch helpers ────────────────────────────────────────────────

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface PaginatedResponse<T> {
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface ColumnFilter {
  id: string;
  value: string | number | boolean | null | undefined;
}

// ─── Task ─────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export const TASK_STATUSES: TaskStatus[] = [
  'pending',
  'in_progress',
  'review',
  'done',
  'blocked',
];

export const TASK_PRIORITIES: TaskPriority[] = [
  'low',
  'medium',
  'high',
  'urgent',
];

export interface Task {
  id: number;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: number | null;
  reporterId?: number | null;
  dueDate?: string | null;
  position: number;
  estimateHours?: number | null;
  metadata?: Record<string, unknown> | null;
  isRecurring: boolean;
  recurrenceRule?: string | null;
  apiKey?: string | null;
  attachment?: string | null;
  coverImage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPayload {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: number | null;
  reporterId?: number | null;
  dueDate?: string | null;
  position?: number;
  estimateHours?: number | null;
  metadata?: Record<string, unknown> | null;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  apiKey?: string | null;
  attachment?: string | null;
  coverImage?: string | null;
}

// ─── Task Comment ─────────────────────────────────────────────────────

export interface TaskComment {
  id: number;
  taskId: number;
  authorId?: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCommentPayload {
  taskId: number;
  content: string;
}

// ─── Task Activity ────────────────────────────────────────────────────

export type TaskActivityAction = 'created' | 'updated' | 'deleted' | 'commented';

export interface TaskActivity {
  id: number;
  action: TaskActivityAction | string;
  description: string;
  userId?: number | null;
  taskId: number;
  createdAt: string;
}

// ─── Task Attachment ──────────────────────────────────────────────────

export interface TaskAttachment {
  id: number;
  filename: string;
  file?: string | null;
  files?: string[] | null;
  taskId: number;
  createdAt: string;
}

// ─── User (light shape for assignee/reporter selects) ─────────────────

export interface UserLight {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role?: { name: string };
  photo?: { path: string } | null;
}

// ─── DataTable cell context ───────────────────────────────────────────
// Minimal TanStack-like row context passed to DataTable column `cell`
// renderers. Mirrors the pattern used by other extensions.

export interface DataTableRow<T = Record<string, unknown>> {
  original: T;
  id?: string;
}

export interface CellContext<T = Record<string, unknown>> {
  row: DataTableRow<T>;
}