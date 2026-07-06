/**
 * Composable for the Content Pipeline extension.
 * Wraps all API calls to the backend content-pipeline endpoints.
 * All endpoints require admin role — backend enforces @Roles(RoleEnum.admin).
 */

import type {
  ApiFetchOptions,
  CreateIdeaPayload,
  CreateProjectPayload,
  DashboardData,
  DashboardSummary,
  Draft,
  GenerateDraftPayload,
  Idea,
  MetricsSnapshot,
  PaginatedResponse,
  Project,
  ProjectMetrics,
  RejectDraftPayload,
  ResearchIdeasPayload,
  UpdateDraftPayload,
  UpdateIdeaPayload,
  UpdateProjectPayload,
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

export function useContentPipeline() {
  const { apiFetch } = useApi();

  // ─── Projects ────────────────────────────────────────────────────────

  async function getProjects(
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<PaginatedResponse<Project> | Project[]> {
    const query: Record<string, string | number | undefined> = { page, limit };
    if (search) query.search = search;
    return apiFetch<PaginatedResponse<Project> | Project[]>('/content-pipeline/projects', { query });
  }

  async function createProject(data: CreateProjectPayload): Promise<Project> {
    return apiFetch<Project>('/content-pipeline/projects', { method: 'POST', body: data });
  }

  async function getProject(id: number | string): Promise<Project> {
    return apiFetch<Project>(`/content-pipeline/projects/${id}`);
  }

  async function updateProject(id: number | string, data: UpdateProjectPayload): Promise<Project> {
    return apiFetch<Project>(`/content-pipeline/projects/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteProject(id: number | string): Promise<void> {
    return apiFetch<void>(`/content-pipeline/projects/${id}`, { method: 'DELETE' });
  }

  // ─── Ideas ───────────────────────────────────────────────────────────

  async function getIdeas(projectId: number | string): Promise<PaginatedResponse<Idea> | Idea[]> {
    return apiFetch<PaginatedResponse<Idea> | Idea[]>(`/content-pipeline/projects/${projectId}/ideas`);
  }

  async function createIdea(projectId: number | string, data: CreateIdeaPayload): Promise<Idea> {
    return apiFetch<Idea>(`/content-pipeline/projects/${projectId}/ideas`, {
      method: 'POST',
      body: data,
    });
  }

  async function researchIdeas(
    projectId: number | string,
    data?: ResearchIdeasPayload,
  ): Promise<Idea[]> {
    return apiFetch<Idea[]>(`/content-pipeline/projects/${projectId}/ideas/research`, {
      method: 'POST',
      body: data ?? {},
    });
  }

  async function updateIdea(id: number | string, data: UpdateIdeaPayload): Promise<Idea> {
    return apiFetch<Idea>(`/content-pipeline/ideas/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteIdea(id: number | string): Promise<void> {
    return apiFetch<void>(`/content-pipeline/ideas/${id}`, { method: 'DELETE' });
  }

  // ─── Drafts ──────────────────────────────────────────────────────────

  async function generateDraft(
    ideaId: number | string,
    data?: GenerateDraftPayload,
  ): Promise<Draft> {
    return apiFetch<Draft>(`/content-pipeline/ideas/${ideaId}/generate`, {
      method: 'POST',
      body: data ?? {},
    });
  }

  async function getDrafts(projectId: number | string): Promise<PaginatedResponse<Draft> | Draft[]> {
    return apiFetch<PaginatedResponse<Draft> | Draft[]>(`/content-pipeline/projects/${projectId}/drafts`);
  }

  async function getDraft(id: number | string): Promise<Draft> {
    return apiFetch<Draft>(`/content-pipeline/drafts/${id}`);
  }

  async function updateDraft(id: number | string, data: UpdateDraftPayload): Promise<Draft> {
    return apiFetch<Draft>(`/content-pipeline/drafts/${id}`, { method: 'PATCH', body: data });
  }

  async function approveDraft(id: number | string): Promise<Draft> {
    return apiFetch<Draft>(`/content-pipeline/drafts/${id}/approve`, { method: 'POST' });
  }

  async function rejectDraft(id: number | string, data?: RejectDraftPayload): Promise<Draft> {
    return apiFetch<Draft>(`/content-pipeline/drafts/${id}/reject`, {
      method: 'POST',
      body: data ?? {},
    });
  }

  async function publishDraft(id: number | string): Promise<Draft> {
    return apiFetch<Draft>(`/content-pipeline/drafts/${id}/publish`, { method: 'POST' });
  }

  // ─── Metrics ─────────────────────────────────────────────────────────

  async function getMetrics(projectId: number | string): Promise<ProjectMetrics | MetricsSnapshot[]> {
    return apiFetch<ProjectMetrics | MetricsSnapshot[]>(`/content-pipeline/projects/${projectId}/metrics`);
  }

  async function getDashboard(): Promise<DashboardData | DashboardSummary> {
    return apiFetch<DashboardData | DashboardSummary>('/content-pipeline/metrics/dashboard');
  }

  return {
    // Projects
    getProjects,
    createProject,
    getProject,
    updateProject,
    deleteProject,
    // Ideas
    getIdeas,
    createIdea,
    researchIdeas,
    updateIdea,
    deleteIdea,
    // Drafts
    generateDraft,
    getDrafts,
    getDraft,
    updateDraft,
    approveDraft,
    rejectDraft,
    publishDraft,
    // Metrics
    getMetrics,
    getDashboard,
  };
}