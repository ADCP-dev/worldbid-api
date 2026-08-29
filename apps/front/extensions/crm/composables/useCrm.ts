import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import type {
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

/**
 * CRM extension — TanStack Query hooks.
 *
 * All endpoints are admin-only (backend enforces RolesGuard). HTTP goes
 * through useApi() (central auth + 401 refresh). Query keys are namespaced
 * under ['crm', ...] and invalidated after each mutation.
 */

export const crmKeys = {
  clients: ['crm', 'clients'] as const,
  client: (id: number | string) => ['crm', 'clients', id] as const,
  contacts: (clientId: number | string) => ['crm', 'clients', clientId, 'contacts'] as const,
  interactions: (clientId: number | string) => ['crm', 'clients', clientId, 'interactions'] as const,
  projects: ['crm', 'projects'] as const,
  project: (id: number | string) => ['crm', 'projects', id] as const,
  statuses: ['crm', 'statuses'] as const,
  origins: ['crm', 'origins'] as const,
  dashboard: ['crm', 'dashboard'] as const,
};

function asList<T>(res: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(res) ? res : (res.data ?? []);
}

// ─── Clients ──────────────────────────────────────────────────────────

export function useClientsQuery(params?: {
  page?: MaybeRefOrGetter<number>;
  search?: MaybeRefOrGetter<string | undefined>;
  statusId?: MaybeRefOrGetter<number | undefined>;
  originId?: MaybeRefOrGetter<number | undefined>;
}) {
  return useQuery({
    queryKey: computed(() => [
      ...crmKeys.clients,
      toValue(params?.page) ?? 1,
      toValue(params?.search) ?? '',
      toValue(params?.statusId) ?? '',
      toValue(params?.originId) ?? '',
    ]),
    queryFn: () => {
      const api = useApi();
      return api.get<PaginatedResponse<Client> | Client[]>('/crm/clients', {
        query: {
          page: toValue(params?.page) ?? 1,
          limit: 20,
          search: toValue(params?.search),
          statusId: toValue(params?.statusId),
          originId: toValue(params?.originId),
        },
      });
    },
  });
}

export function useClientQuery(id: MaybeRefOrGetter<number | string | undefined>) {
  return useQuery({
    queryKey: computed(() => crmKeys.client(toValue(id) ?? 0)),
    enabled: computed(() => toValue(id) !== undefined),
    queryFn: () => {
      const api = useApi();
      return api.get<Client>(`/crm/clients/${toValue(id)}`);
    },
  });
}

export function useCreateClientMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientPayload) => {
      const api = useApi();
      return api.post<Client>('/crm/clients', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.clients });
      qc.invalidateQueries({ queryKey: crmKeys.dashboard });
    },
  });
}

export function useUpdateClientMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: ClientPayload }) => {
      const api = useApi();
      return api.patch<Client>(`/crm/clients/${id}`, data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: crmKeys.clients });
      qc.invalidateQueries({ queryKey: crmKeys.client(vars.id) });
      qc.invalidateQueries({ queryKey: crmKeys.dashboard });
    },
  });
}

export function useDeleteClientMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => {
      const api = useApi();
      return api.delete(`/crm/clients/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.clients });
      qc.invalidateQueries({ queryKey: crmKeys.dashboard });
    },
  });
}

// ─── Contacts (nested under client) ───────────────────────────────────

export function useContactsQuery(clientId: MaybeRefOrGetter<number | string | undefined>) {
  return useQuery({
    queryKey: computed(() => crmKeys.contacts(toValue(clientId) ?? 0)),
    enabled: computed(() => toValue(clientId) !== undefined),
    queryFn: () => {
      const api = useApi();
      return api.get<Contact[]>(`/crm/clients/${toValue(clientId)}/contacts`);
    },
  });
}

export function useCreateContactMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: number | string; data: ContactPayload }) => {
      const api = useApi();
      return api.post<Contact>(`/crm/clients/${clientId}/contacts`, data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: crmKeys.contacts(vars.clientId) });
    },
  });
}

export function useUpdateContactMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, id, data }: { clientId: number | string; id: number | string; data: ContactPayload }) => {
      const api = useApi();
      return api.patch<Contact>(`/crm/clients/${clientId}/contacts/${id}`, data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: crmKeys.contacts(vars.clientId) });
    },
  });
}

export function useDeleteContactMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, id }: { clientId: number | string; id: number | string }) => {
      const api = useApi();
      return api.delete(`/crm/clients/${clientId}/contacts/${id}`);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: crmKeys.contacts(vars.clientId) });
    },
  });
}

// ─── Interactions (nested under client) ───────────────────────────────

export function useInteractionsQuery(clientId: MaybeRefOrGetter<number | string | undefined>) {
  return useQuery({
    queryKey: computed(() => crmKeys.interactions(toValue(clientId) ?? 0)),
    enabled: computed(() => toValue(clientId) !== undefined),
    queryFn: () => {
      const api = useApi();
      return api.get<PaginatedResponse<Interaction> | Interaction[]>(
        `/crm/clients/${toValue(clientId)}/interactions`,
        { query: { limit: 50 } },
      );
    },
  });
}

export function useCreateInteractionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: number | string; data: InteractionPayload }) => {
      const api = useApi();
      return api.post<Interaction>(`/crm/clients/${clientId}/interactions`, data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: crmKeys.interactions(vars.clientId) });
      qc.invalidateQueries({ queryKey: crmKeys.dashboard });
    },
  });
}

export function useUpdateInteractionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, id, data }: { clientId: number | string; id: number | string; data: InteractionPayload }) => {
      const api = useApi();
      return api.patch<Interaction>(`/crm/clients/${clientId}/interactions/${id}`, data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: crmKeys.interactions(vars.clientId) });
    },
  });
}

export function useDeleteInteractionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, id }: { clientId: number | string; id: number | string }) => {
      const api = useApi();
      return api.delete(`/crm/clients/${clientId}/interactions/${id}`);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: crmKeys.interactions(vars.clientId) });
    },
  });
}

// ─── Projects ─────────────────────────────────────────────────────────

export function useProjectsQuery(clientId?: MaybeRefOrGetter<number | string | undefined>) {
  return useQuery({
    queryKey: computed(() => [...crmKeys.projects, toValue(clientId) ?? '']),
    queryFn: () => {
      const api = useApi();
      return api.get<Project[]>('/crm/projects', { query: { clientId: toValue(clientId) } });
    },
  });
}

export function useProjectQuery(id: MaybeRefOrGetter<number | string | undefined>) {
  return useQuery({
    queryKey: computed(() => crmKeys.project(toValue(id) ?? 0)),
    enabled: computed(() => toValue(id) !== undefined),
    queryFn: () => {
      const api = useApi();
      return api.get<Project>(`/crm/projects/${toValue(id)}`);
    },
  });
}

export function useCreateProjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectPayload) => {
      const api = useApi();
      return api.post<Project>('/crm/projects', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.projects });
      qc.invalidateQueries({ queryKey: crmKeys.dashboard });
    },
  });
}

export function useUpdateProjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: ProjectPayload }) => {
      const api = useApi();
      return api.patch<Project>(`/crm/projects/${id}`, data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: crmKeys.projects });
      qc.invalidateQueries({ queryKey: crmKeys.project(vars.id) });
      qc.invalidateQueries({ queryKey: crmKeys.dashboard });
    },
  });
}

export function useDeleteProjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => {
      const api = useApi();
      return api.delete(`/crm/projects/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.projects });
      qc.invalidateQueries({ queryKey: crmKeys.dashboard });
    },
  });
}

// ─── Statuses / Origins (settings) ────────────────────────────────────

export function useStatusesQuery() {
  return useQuery({
    queryKey: crmKeys.statuses,
    queryFn: () => {
      const api = useApi();
      return api.get<Status[]>('/crm/statuses');
    },
  });
}

export function useCreateStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StatusPayload) => {
      const api = useApi();
      return api.post<Status>('/crm/statuses', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.statuses });
      qc.invalidateQueries({ queryKey: crmKeys.clients });
    },
  });
}

export function useUpdateStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: StatusPayload }) => {
      const api = useApi();
      return api.patch<Status>(`/crm/statuses/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.statuses });
      qc.invalidateQueries({ queryKey: crmKeys.clients });
    },
  });
}

export function useDeleteStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => {
      const api = useApi();
      return api.delete(`/crm/statuses/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: crmKeys.statuses }),
  });
}

export function useOriginsQuery() {
  return useQuery({
    queryKey: crmKeys.origins,
    queryFn: () => {
      const api = useApi();
      return api.get<Origin[]>('/crm/origins');
    },
  });
}

export function useCreateOriginMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: OriginPayload) => {
      const api = useApi();
      return api.post<Origin>('/crm/origins', data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: crmKeys.origins }),
  });
}

export function useUpdateOriginMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: OriginPayload }) => {
      const api = useApi();
      return api.patch<Origin>(`/crm/origins/${id}`, data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: crmKeys.origins }),
  });
}

export function useDeleteOriginMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => {
      const api = useApi();
      return api.delete(`/crm/origins/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: crmKeys.origins }),
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────

export function useCrmDashboardQuery() {
  return useQuery({
    queryKey: crmKeys.dashboard,
    queryFn: () => {
      const api = useApi();
      return api.get<DashboardData>('/crm/dashboard');
    },
  });
}

export { asList as crmAsList };