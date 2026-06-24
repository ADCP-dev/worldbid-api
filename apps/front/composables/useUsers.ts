/**
 * useUsers — Standard API composable for the User entity.
 *
 * Pattern: one file per entity. Each function is a TanStack Query hook
 * (useQuery or useMutation) that delegates to `useApi()` for transport.
 *
 * Cache strategy:
 *   - List query: ['users', params]
 *   - Single query: ['user', id]
 *   - All write mutations invalidate the list query and the single
 *     query for the affected id (when known).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'

export interface User {
  id: number | string
  email: string
  provider: string
  socialId?: string | null
  firstName: string | null
  lastName: string | null
  role?: { id: number | string; name?: string } | null
  status?: { id: number | string; name?: string }
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface UserListParams {
  page?: number
  limit?: number
  search?: string
  roleId?: number | string
  statusId?: number | string
}

export type CreateUserInput = {
  email: string
  password?: string
  firstName?: string
  lastName?: string
  roleId?: number | string
  statusId?: number | string
}

export type UpdateUserInput = Partial<CreateUserInput>

// ── Queries ──────────────────────────────────────────────────────────────

export function useUsersQuery(params: UserListParams = {}) {
  const api = useApi()
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => api.get<User[]>('/users', { query: params as Record<string, string | number> }),
  })
}

export function useUserQuery(id: MaybeRefOrGetter<number | string>) {
  const api = useApi()
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get<User>(`/users/${toValue(id)}`),
    enabled: computed(() => !!toValue(id)),
  })
}

// ── Mutations ────────────────────────────────────────────────────────────

export function useCreateUserMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserInput) => api.post<User>('/users', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useUpdateUserMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: UpdateUserInput }) =>
      api.patch<User>(`/users/${id}`, data),
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['user', user.id] })
    },
  })
}

export function useDeleteUserMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useChangePasswordMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, password }: { id: number | string; password: string }) =>
      api.patch<User>(`/users/${id}`, { password }),
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: ['user', user.id] })
    },
  })
}

export function useChangeUserRoleMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, roleId }: { id: number | string; roleId: number | string }) =>
      api.patch<User>(`/users/${id}`, { role: { id: roleId } }),
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['user', user.id] })
    },
  })
}

export function useChangeUserStatusMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, statusId }: { id: number | string; statusId: number | string }) =>
      api.patch<User>(`/users/${id}`, { status: { id: statusId } }),
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['user', user.id] })
    },
  })
}
