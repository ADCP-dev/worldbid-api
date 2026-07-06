/**
 * Shared TypeScript interfaces for the Autonomous Agent frontend extension.
 * Mirrors backend DTOs and entities in apps/back/src/extensions/autonomous-agent/.
 */

// ─── API fetch helpers ────────────────────────────────────────────────

export interface ApiFetchOptions {
  method?: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown> | unknown;
  headers?: Record<string, string>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

// ─── Entities ─────────────────────────────────────────────────────────

export interface RunEntity {
  id: string;
  configId: string;
  status: string;
  runType?: string;
  startedAt: string;
  finishedAt: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  projectId: string | null;
}

export interface ConfigEntity {
  id: string;
  name?: string;
  enabled?: boolean;
  cron?: string;
  projectId: string | number | null;
  options?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  lastRunAt?: string | null;
  researchCron?: string | null;
  generateCron?: string | null;
  publishCron?: string | null;
  metricsCron?: string | null;
  autoApproveIdeas?: boolean;
  autoApproveDrafts?: boolean;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
  telegramChatId?: string | null;
}

export interface ProjectEntity {
  id: string;
  name: string;
}

// ─── DataTable cell context ───────────────────────────────────────────
// Minimal TanStack-like row context passed to DataTable column `cell`
// renderers. Mirrors the pattern used by other extensions.

export interface DataTableRow<T> {
  original: T;
  id: string;
}

export interface CellContext<T> {
  row: DataTableRow<T>;
}

// ─── Payloads ─────────────────────────────────────────────────────────

export interface ConfigPayload {
  name: string;
  enabled: boolean;
  cron: string;
  projectId?: string | number | null;
  options: Record<string, unknown>;
}

export interface AutonomousConfigPayload {
  projectId?: number;
  researchCron?: string;
  generateCron?: string;
  publishCron?: string;
  metricsCron?: string;
  autoApproveIdeas?: boolean;
  autoApproveDrafts?: boolean;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
  telegramChatId?: string;
}