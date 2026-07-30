import { ref, readonly } from 'vue'
import type { Ref } from 'vue'

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

/* ------------------------------------------------------------------ *
 * Composable
 * ------------------------------------------------------------------ */

export function useSpecResource() {
  const config = useRuntimeConfig()
  const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`

  /** Reactive map of all resources keyed by name */
  const resources = ref<Record<string, ResourceSpec>>({}) as Ref<Record<string, ResourceSpec>>

  /** Loading flag for initial spec fetch */
  const loading = ref(false)

  /** Error from spec fetch */
  const error = ref<Error | null>(null)

  /** Whether the spec has been loaded at least once */
  let loaded = false

  /** Fetch (or re-fetch) the spec metadata. */
  async function loadSpec(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<SpecResponse>(`/api/v1/_spec/resources`, { baseURL })
      resources.value = res.resources ?? {}
      loaded = true
    } catch (e) {
      error.value = e as Error
      console.error('[useSpecResource] Failed to load spec:', e)
    } finally {
      loading.value = false
    }
  }

  /** Ensure spec is loaded once (idempotent). */
  async function ensureSpec(): Promise<void> {
    if (!loaded) await loadSpec()
  }

  /** Get a single resource spec by name. */
  function getResource(name: string): ResourceSpec | undefined {
    return resources.value[name]
  }

  /** Resolve the endpoint path for a resource. */
  function endpointFor(resourceName: string): string {
    const spec = getResource(resourceName)
    return spec?.endpoint ?? resourceName
  }

  /* ---------------- CRUD operations ---------------- */

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
    const pk = getResource(resourceName)?.primaryKey ?? 'id'
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

  /** Get a single record by id. */
  async function findOne<T = Record<string, unknown>>(
    resourceName: string,
    id: string | number,
  ): Promise<T> {
    const endpoint = endpointFor(resourceName)
    const res = await $fetch<{ data: T } | T>(`/api/v1/${endpoint}/${encodeURIComponent(String(id))}`, {
      baseURL,
    })
    // NestJS commonly wraps single results in { data: ... }
    return (res as { data?: T })?.data ?? (res as T)
  }

  /** Load async options for a 'select-async' ref field. */
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

  return {
    resources: readonly(resources),
    loading: readonly(loading),
    error: readonly(error),
    loadSpec,
    ensureSpec,
    getResource,
    list,
    create,
    update,
    remove,
    findOne,
    loadRefOptions,
  }
}