import { computed, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

/* ------------------------------------------------------------------ *
 * Types — mirror the backend GET /api/v1/_spec/resources payload.
 * Kept intentionally loose (unknown friendly) so the layer stays
 * decoupled from the exact backend implementation.
 * ------------------------------------------------------------------ */

export interface FieldUiHints {
  /** Column display hint */
  display?: 'text' | 'badge' | 'date' | 'avatar' | 'truncate' | 'icon' | 'link'
  /** Form input hint */
  formInput?: 'text' | 'textarea' | 'select' | 'datepicker' | 'file-upload' | 'select-async'
  /** Colors map for badge display: { value: 'badge-primary' } */
  colors?: Record<string, string>
  /** Truncation length for 'truncate' display */
  truncateLength?: number
  /** Link target pattern, e.g. '/app/users/{id}' */
  linkPattern?: string
  /** Date format string (Intl.DateTimeFormat options or pattern) */
  dateFormat?: string
  /** Avatar image field name on the same record (fallback to letter) */
  avatarImageField?: string
  /** Icon name for 'icon' display */
  iconName?: string
}

export interface FieldSpec {
  name: string
  label?: string
  type?: string
  /** Enum values for select fields */
  enum?: Array<string | number>
  /** True when field references another resource */
  ref?: {
    resource: string
    labelField?: string
    valueField?: string
  }
  /** True when field is the primary identifier */
  isPrimary?: boolean
  /** True when field is required */
  required?: boolean
  /** True when field is read-only */
  readOnly?: boolean
  /** True when field supports sorting */
  sortable?: boolean
  /** UI hints for display + form rendering */
  ui?: FieldUiHints
  /** Default value for create forms */
  default?: unknown
}

export interface ResourcePermissions {
  create?: string[]
  read?: string[]
  update?: string[]
  delete?: string[]
}

export interface ResourceUi {
  /** Singular label, e.g. "User" */
  singular?: string
  /** Plural label, e.g. "Users" */
  plural?: string
  /** Icon name for nav/cards */
  icon?: string
  /** Fields to show in list table (defaults to all non-primary) */
  listFields?: string[]
  /** Fields to show in form (defaults to all editable) */
  formFields?: string[]
}

export interface ResourceSpec {
  name: string
  /** API endpoint path segment, e.g. 'users' → /api/v1/users */
  endpoint?: string
  /** Primary key field name (default 'id') */
  primaryKey?: string
  fields: FieldSpec[]
  permissions?: ResourcePermissions
  ui?: ResourceUi
}

export interface SpecResponse {
  resources: Record<string, ResourceSpec>
}

export interface ListResponse<T = Record<string, unknown>> {
  data: T[]
  total?: number
  meta?: { total?: number }
}

export interface ListParams {
  page?: number
  limit?: number
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
  filter?: Record<string, unknown>
}

export interface DashboardData {
  name: string
  displayName?: string
  panels: Array<{
    name: string
    chart: string
    label?: string
    data: {
      value?: number
      labels?: string[]
      values?: number[]
      [key: string]: unknown
    }
  }>
}

/* ------------------------------------------------------------------ *
 * Composable
 * ------------------------------------------------------------------ */

export function useSpecResource() {
  const config = useRuntimeConfig()
  const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`
  const queryClient = useQueryClient()

  /* ---------------- Spec metadata ---------------- */

  const specQuery = useQuery<Record<string, ResourceSpec>, Error, Record<string, ResourceSpec>>({
    queryKey: ['_spec', 'resources'],
    queryFn: async () => {
      const res = await $fetch<SpecResponse>(`/api/v1/_spec/resources`, { baseURL })
      return res.resources ?? {}
    },
  })

  const resources = computed<Record<string, ResourceSpec>>(() => specQuery.data.value ?? {})

  function getResource(name: string): ComputedRef<ResourceSpec | undefined> {
    return computed(() => resources.value[name])
  }

  function endpointFor(resourceName: string): string {
    const spec = resources.value[resourceName]
    return spec?.endpoint ?? resourceName
  }

  /* ---------------- CRUD operations (raw fetch) ---------------- */

  async function list<T = Record<string, unknown>>(
    resourceName: string,
    params: ListParams = {},
  ): Promise<ListResponse<T>> {
    const endpoint = endpointFor(resourceName)
    const query: Record<string, unknown> = {}
    if (params.page) query.page = params.page
    if (params.limit) query.limit = params.limit
    if (params.search) query.search = params.search
    if (params.sort) query.sort = params.sort
    if (params.order) query.order = params.order
    if (params.filter) {
      for (const [k, v] of Object.entries(params.filter)) {
        if (v !== undefined && v !== null && v !== '') query[`filter[${k}]`] = v
      }
    }
    return $fetch<ListResponse<T>>(`/api/v1/${endpoint}`, { baseURL, query })
  }

  async function create<T = Record<string, unknown>>(
    resourceName: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const endpoint = endpointFor(resourceName)
    return $fetch<T>(`/api/v1/${endpoint}`, { baseURL, method: 'POST', body })
  }

  async function update<T = Record<string, unknown>>(
    resourceName: string,
    id: string | number,
    body: Record<string, unknown>,
  ): Promise<T> {
    const endpoint = endpointFor(resourceName)
    return $fetch<T>(`/api/v1/${endpoint}/${encodeURIComponent(String(id))}`, {
      baseURL,
      method: 'PATCH',
      body,
    })
  }

  async function remove(
    resourceName: string,
    id: string | number,
  ): Promise<void> {
    const endpoint = endpointFor(resourceName)
    await $fetch(`/api/v1/${endpoint}/${encodeURIComponent(String(id))}`, {
      baseURL,
      method: 'DELETE',
    })
  }

  async function findOne<T = Record<string, unknown>>(
    resourceName: string,
    id: string | number,
  ): Promise<T> {
    const endpoint = endpointFor(resourceName)
    const res = await $fetch<{ data: T } | T>(`/api/v1/${endpoint}/${encodeURIComponent(String(id))}`, {
      baseURL,
    })
    return (res as { data?: T })?.data ?? (res as T)
  }

  async function loadRefOptions(
    refResource: string,
    labelField = 'name',
    valueField = 'id',
  ): Promise<Array<{ label: string; value: string | number }>> {
    const res = await list(refResource, { limit: 100 })
    return (res.data ?? []).map((row: Record<string, unknown>) => ({
      label: String(row[labelField] ?? ''),
      value: row[valueField] as string | number,
    }))
  }

  async function fetchView(viewName: string): Promise<DashboardData> {
    return $fetch<DashboardData>(`/api/v1/_spec/views/${encodeURIComponent(viewName)}`, { baseURL })
  }

  /* ---------------- TanStack Query wrappers ---------------- */

  function useListQuery<T = Record<string, unknown>>(
    resourceName: MaybeRefOrGetter<string>,
    params: MaybeRefOrGetter<ListParams> = {},
  ) {
    return useQuery({
      queryKey: () => ['spec', toValue(resourceName), 'list', toValue(params)],
      queryFn: () => list<T>(toValue(resourceName), toValue(params)),
    } as const)
  }

  function useFindOneQuery<T = Record<string, unknown>>(
    resourceName: MaybeRefOrGetter<string>,
    id: MaybeRefOrGetter<string | number | undefined>,
  ) {
    return useQuery({
      queryKey: () => ['spec', toValue(resourceName), 'findOne', toValue(id)],
      queryFn: () => {
        const idVal = toValue(id)
        if (!idVal) throw new Error('id is required')
        return findOne<T>(toValue(resourceName), idVal)
      },
      enabled: () => !!toValue(id),
    } as const)
  }

  function useCreateMutation<T = Record<string, unknown>>(resourceName: MaybeRefOrGetter<string>) {
    return useMutation({
      mutationFn: (body: Record<string, unknown>) => create<T>(toValue(resourceName), body),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['spec', toValue(resourceName), 'list'] })
      },
    })
  }

  function useUpdateMutation<T = Record<string, unknown>>(resourceName: MaybeRefOrGetter<string>) {
    return useMutation({
      mutationFn: (vars: { id: string | number; body: Record<string, unknown> }) =>
        update<T>(toValue(resourceName), vars.id, vars.body),
      onSuccess: () => {
        const name = toValue(resourceName)
        queryClient.invalidateQueries({ queryKey: ['spec', name, 'list'] })
        queryClient.invalidateQueries({ queryKey: ['spec', name, 'findOne'] })
      },
    })
  }

  function useRemoveMutation(resourceName: MaybeRefOrGetter<string>) {
    return useMutation({
      mutationFn: (id: string | number) => remove(toValue(resourceName), id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['spec', toValue(resourceName), 'list'] })
      },
    })
  }

  function useRefOptionsQuery(
    refResource: MaybeRefOrGetter<string>,
    labelField = 'name',
    valueField = 'id',
  ) {
    return useQuery({
      queryKey: () => ['spec', 'refOptions', toValue(refResource), labelField, valueField],
      queryFn: () => loadRefOptions(toValue(refResource), labelField, valueField),
      enabled: () => !!toValue(refResource),
    } as const)
  }

  function useViewQuery(viewName: MaybeRefOrGetter<string>) {
    return useQuery({
      queryKey: () => ['spec', 'view', toValue(viewName)],
      queryFn: () => fetchView(toValue(viewName)),
      enabled: () => !!toValue(viewName),
    } as const)
  }

  return {
    resources,
    getResource,
    endpointFor,
    list,
    create,
    update,
    remove,
    findOne,
    loadRefOptions,
    fetchView,
    useListQuery,
    useFindOneQuery,
    useCreateMutation,
    useUpdateMutation,
    useRemoveMutation,
    useRefOptionsQuery,
    useViewQuery,
  }
}
