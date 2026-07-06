/**
 * Composable for the Autonomous Agent extension.
 * Wraps all API calls to the backend autonomous-agent endpoints.
 * All endpoints require admin role — backend enforces @Roles(RoleEnum.admin).
 */

import type { ApiFetchOptions, PaginatedResponse } from '../types';

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
    const res = await $fetch<T>(
      `${baseUrl}${apiPrefix}${path}`,
      {
        ...options,
        headers,
      } as Parameters<typeof $fetch<T>>[1],
    );
    return res as T;
  }

  return { apiFetch };
}

export function useAutonomousAgent() {
  const { apiFetch } = useApi();

  // ─── Configs ─────────────────────────────────────────────────────────

  async function getConfigs(page = 1, limit = 20, search?: string) {
    const query: Record<string, unknown> = { page, limit };
    if (search) query.search = search;
    return apiFetch('/autonomous-agent/configs', { query });
  }

  async function createConfig(data: Record<string, unknown>) {
    return apiFetch('/autonomous-agent/configs', { method: 'POST', body: data });
  }

  async function getConfig(id: number | string) {
    return apiFetch(`/autonomous-agent/configs/${id}`);
  }

  async function updateConfig(id: number | string, data: Record<string, unknown>) {
    return apiFetch(`/autonomous-agent/configs/${id}`, { method: 'PATCH', body: data });
  }

  async function pauseConfig(id: number | string) {
    return apiFetch(`/autonomous-agent/configs/${id}/pause`, { method: 'POST' });
  }

  async function resumeConfig(id: number | string) {
    return apiFetch(`/autonomous-agent/configs/${id}/resume`, { method: 'POST' });
  }

  async function deleteConfig(id: number | string) {
    return apiFetch(`/autonomous-agent/configs/${id}`, { method: 'DELETE' });
  }

  // ─── Runs ────────────────────────────────────────────────────────────

  async function getRuns(
    page = 1,
    limit = 20,
    filters?: { projectId?: string; runType?: string; status?: string },
  ) {
    const query: Record<string, unknown> = { page, limit };
    if (filters?.projectId) query.projectId = filters.projectId;
    if (filters?.runType) query.runType = filters.runType;
    if (filters?.status) query.status = filters.status;
    return apiFetch<PaginatedResponse<unknown>>('/autonomous-agent/runs', { query });
  }

  async function getRun(id: number | string) {
    return apiFetch(`/autonomous-agent/runs/${id}`);
  }

  return {
    // Configs
    getConfigs,
    createConfig,
    getConfig,
    updateConfig,
    pauseConfig,
    resumeConfig,
    deleteConfig,
    // Runs
    getRuns,
    getRun,
  };
}