/**
 * Composable for the CRM extension.
 * Wraps all API calls to the backend CRM extension endpoints.
 * All endpoints require admin role — backend enforces @Roles(RoleEnum.admin).
 */

function useApi() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  const baseUrl = config.public.apiUrl as string;
  const apiPrefix = (config.public.apiPrefix as string) || '/api/v1';

  async function apiFetch<T>(path: string, options: any = {}): Promise<T> {
    const headers: Record<string, string> = { ...options.headers };
    if (authStore.token) {
      headers.Authorization = `Bearer ${authStore.token}`;
    }
    const res = await $fetch<T>(`${baseUrl}${apiPrefix}${path}`, {
      ...options,
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
  ) {
    const query: Record<string, any> = { page, limit };
    if (search) query.search = search;
    if (statusId) query.statusId = statusId;
    if (originId) query.originId = originId;
    return apiFetch('/crm/clients', { query });
  }

  async function getClient(id: number | string) {
    return apiFetch(`/crm/clients/${id}`);
  }

  async function createClient(data: Record<string, any>) {
    return apiFetch('/crm/clients', { method: 'POST', body: data });
  }

  async function updateClient(id: number | string, data: Record<string, any>) {
    return apiFetch(`/crm/clients/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteClient(id: number | string) {
    return apiFetch(`/crm/clients/${id}`, { method: 'DELETE' });
  }

  // ─── Contacts ────────────────────────────────────────────────────────

  async function getContacts(clientId: number | string) {
    return apiFetch(`/crm/clients/${clientId}/contacts`);
  }

  async function createContact(clientId: number | string, data: Record<string, any>) {
    return apiFetch(`/crm/clients/${clientId}/contacts`, { method: 'POST', body: data });
  }

  async function updateContact(id: number | string, data: Record<string, any>) {
    return apiFetch(`/crm/clients/0/contacts/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteContact(id: number | string) {
    return apiFetch(`/crm/clients/0/contacts/${id}`, { method: 'DELETE' });
  }

  // ─── Interactions ────────────────────────────────────────────────────

  async function getInteractions(clientId: number | string, page = 1, limit = 20) {
    return apiFetch(`/crm/clients/${clientId}/interactions`, { query: { page, limit } });
  }

  async function createInteraction(clientId: number | string, data: Record<string, any>) {
    return apiFetch(`/crm/clients/${clientId}/interactions`, { method: 'POST', body: data });
  }

  async function updateInteraction(id: number | string, data: Record<string, any>) {
    return apiFetch(`/crm/clients/0/interactions/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteInteraction(id: number | string) {
    return apiFetch(`/crm/clients/0/interactions/${id}`, { method: 'DELETE' });
  }

  // ─── Projects ────────────────────────────────────────────────────────

  async function getProjects(clientId?: number | string) {
    const query: Record<string, any> = {};
    if (clientId) query.clientId = clientId;
    return apiFetch('/crm/projects', { query });
  }

  async function getProject(id: number | string) {
    return apiFetch(`/crm/projects/${id}`);
  }

  async function createProject(data: Record<string, any>) {
    return apiFetch('/crm/projects', { method: 'POST', body: data });
  }

  async function updateProject(id: number | string, data: Record<string, any>) {
    return apiFetch(`/crm/projects/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteProject(id: number | string) {
    return apiFetch(`/crm/projects/${id}`, { method: 'DELETE' });
  }

  // ─── Statuses ─────────────────────────────────────────────────────────

  async function getStatuses() {
    return apiFetch('/crm/statuses');
  }

  async function createStatus(data: Record<string, any>) {
    return apiFetch('/crm/statuses', { method: 'POST', body: data });
  }

  async function updateStatus(id: number | string, data: Record<string, any>) {
    return apiFetch(`/crm/statuses/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteStatus(id: number | string) {
    return apiFetch(`/crm/statuses/${id}`, { method: 'DELETE' });
  }

  // ─── Origins ─────────────────────────────────────────────────────────

  async function getOrigins() {
    return apiFetch('/crm/origins');
  }

  async function createOrigin(data: Record<string, any>) {
    return apiFetch('/crm/origins', { method: 'POST', body: data });
  }

  async function updateOrigin(id: number | string, data: Record<string, any>) {
    return apiFetch(`/crm/origins/${id}`, { method: 'PATCH', body: data });
  }

  async function deleteOrigin(id: number | string) {
    return apiFetch(`/crm/origins/${id}`, { method: 'DELETE' });
  }

  // ─── Dashboard ───────────────────────────────────────────────────────

  async function getDashboard() {
    return apiFetch('/crm/dashboard');
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