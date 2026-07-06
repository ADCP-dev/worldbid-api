/**
 * Composable for the CRM extension.
 * Wraps all API calls to the backend CRM extension endpoints.
 * All endpoints require admin role — backend enforces @Roles(RoleEnum.admin).
 */

import type {
  ApiFetchOptions,
  Client,
  ClientPayload,
  Contact,
  ContactPayload,
  DashboardData,
  Interaction,
  InteractionPayload,
  Origin,
  OriginPayload,
  PaginatedResponse,
  Project,
  ProjectPayload,
  Status,
  StatusPayload,
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

export function useCrm() {
  const { apiFetch } = useApi();

  // ─── Clients ─────────────────────────────────────────────────────────

  async function getClients(
    page = 1,
    limit = 20,
    search?: string,
    statusId?: number,
    originId?: number,
  ): Promise<PaginatedResponse<Client> | Client[]> {
    const query: Record<string, string | number | undefined> = { page, limit };
    if (search) query.search = search;
    if (statusId) query.statusId = statusId;
    if (originId) query.originId = originId;
    return apiFetch<PaginatedResponse<Client> | Client[]>('/crm/clients', { query });
  }

  async function getClient(id: number | string): Promise<Client> {
    return apiFetch<Client>(`/crm/clients/${id}`);
  }

  async function createClient(data: ClientPayload): Promise<Client> {
    return apiFetch<Client>('/crm/clients', { method: 'POST', body: data });
  }

  async function updateClient(id: number | string, data: ClientPayload): Promise<Client> {
    return apiFetch<Client>(`/crm/clients/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteClient(id: number | string): Promise<void> {
    return apiFetch<void>(`/crm/clients/${id}`, { method: 'DELETE' });
  }

  // ─── Contacts ────────────────────────────────────────────────────────

  async function getContacts(clientId: number | string): Promise<Contact[]> {
    return apiFetch<Contact[]>(`/crm/clients/${clientId}/contacts`);
  }

  async function createContact(clientId: number | string, data: ContactPayload): Promise<Contact> {
    return apiFetch<Contact>(`/crm/clients/${clientId}/contacts`, { method: 'POST', body: data });
  }

  async function updateContact(id: number | string, data: ContactPayload): Promise<Contact> {
    return apiFetch<Contact>(`/crm/clients/0/contacts/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteContact(id: number | string): Promise<void> {
    return apiFetch<void>(`/crm/clients/0/contacts/${id}`, { method: 'DELETE' });
  }

  // ─── Interactions ────────────────────────────────────────────────────

  async function getInteractions(
    clientId: number | string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<Interaction> | Interaction[]> {
    return apiFetch<PaginatedResponse<Interaction> | Interaction[]>(
      `/crm/clients/${clientId}/interactions`,
      { query: { page, limit } },
    );
  }

  async function createInteraction(clientId: number | string, data: InteractionPayload): Promise<Interaction> {
    return apiFetch<Interaction>(`/crm/clients/${clientId}/interactions`, { method: 'POST', body: data });
  }

  async function updateInteraction(id: number | string, data: InteractionPayload): Promise<Interaction> {
    return apiFetch<Interaction>(`/crm/clients/0/interactions/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteInteraction(id: number | string): Promise<void> {
    return apiFetch<void>(`/crm/clients/0/interactions/${id}`, { method: 'DELETE' });
  }

  // ─── Projects ────────────────────────────────────────────────────────

  async function getProjects(clientId?: number | string): Promise<Project[]> {
    const query: Record<string, string | number | undefined> = {};
    if (clientId) query.clientId = clientId;
    return apiFetch<Project[]>('/crm/projects', { query });
  }

  async function getProject(id: number | string): Promise<Project> {
    return apiFetch<Project>(`/crm/projects/${id}`);
  }

  async function createProject(data: ProjectPayload): Promise<Project> {
    return apiFetch<Project>('/crm/projects', { method: 'POST', body: data });
  }

  async function updateProject(id: number | string, data: ProjectPayload): Promise<Project> {
    return apiFetch<Project>(`/crm/projects/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteProject(id: number | string): Promise<void> {
    return apiFetch<void>(`/crm/projects/${id}`, { method: 'DELETE' });
  }

  // ─── Statuses ─────────────────────────────────────────────────────────

  async function getStatuses(): Promise<Status[]> {
    return apiFetch<Status[]>('/crm/statuses');
  }

  async function createStatus(data: StatusPayload): Promise<Status> {
    return apiFetch<Status>('/crm/statuses', { method: 'POST', body: data });
  }

  async function updateStatus(id: number | string, data: StatusPayload): Promise<Status> {
    return apiFetch<Status>(`/crm/statuses/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteStatus(id: number | string): Promise<void> {
    return apiFetch<void>(`/crm/statuses/${id}`, { method: 'DELETE' });
  }

  // ─── Origins ─────────────────────────────────────────────────────────

  async function getOrigins(): Promise<Origin[]> {
    return apiFetch<Origin[]>('/crm/origins');
  }

  async function createOrigin(data: OriginPayload): Promise<Origin> {
    return apiFetch<Origin>('/crm/origins', { method: 'POST', body: data });
  }

  async function updateOrigin(id: number | string, data: OriginPayload): Promise<Origin> {
    return apiFetch<Origin>(`/crm/origins/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteOrigin(id: number | string): Promise<void> {
    return apiFetch<void>(`/crm/origins/${id}`, { method: 'DELETE' });
  }

  // ─── Dashboard ───────────────────────────────────────────────────────

  async function getDashboard(): Promise<DashboardData> {
    return apiFetch<DashboardData>('/crm/dashboard');
  }

  return {
    // Clients
    getClients,
    getClient,
    createClient,
    updateClient,
    deleteClient,
    // Contacts
    getContacts,
    createContact,
    updateContact,
    deleteContact,
    // Interactions
    getInteractions,
    createInteraction,
    updateInteraction,
    deleteInteraction,
    // Projects
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    // Statuses
    getStatuses,
    createStatus,
    updateStatus,
    deleteStatus,
    // Origins
    getOrigins,
    createOrigin,
    updateOrigin,
    deleteOrigin,
    // Dashboard
    getDashboard,
  };
}