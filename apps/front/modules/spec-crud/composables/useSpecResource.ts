import { computed, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

/* ------------------------------------------------------------------ *
 * Types — mirror the backend GET /api/v1/_spec/resources payload.
 * Kept intentionally loose (unknown friendly) so the layer stays
 * decoupled from the exact backend implementation.
 * ------------------------------------------------------------------ */

/**
 * UI hints for a field. Mirrors the backend `FieldUISpec`
 * (apps/back/src/core/spec-engine/spec.types.ts). The backend is the source of
 * truth; this interface is the frontend projection. Kept as a union so new
 * hints added on the backend surface as compile errors here.
 *
 * spec-engine-v2-frontend-and-loader (Slice 2): widened `formInput` to include
 * the new stepper/toggle-group/time/time-window/weekday-picker/radio/switch
 * values, and added the new layout/visibility/file hints (section, showIf,
 * cols, order, placeholder, helpText, multiple, accept).
 */
export interface FieldUiHints {
  /** Column display hint */
  display?: 'text' | 'badge' | 'date' | 'avatar' | 'truncate' | 'icon' | 'link'
  /**
   * Form input hint. Pre-change values: text, textarea, select, datepicker,
   * file-upload, select-async. spec-engine-v2 adds: time, toggle-group,
   * stepper, radio, switch, weekday-picker, time-window.
   */
  formInput?:
    | 'text'
    | 'textarea'
    | 'select'
    | 'datepicker'
    | 'file-upload'
    | 'select-async'
    | 'time'
    | 'toggle-group'
    | 'stepper'
    | 'radio'
    | 'switch'
    | 'weekday-picker'
    | 'time-window'
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
  /** Table interactions (mirrors backend FieldUISpec) */
  filterable?: boolean
  sortable?: boolean
  filterType?: 'text' | 'select' | 'dateRange' | 'boolean'
  /** Logical section this field belongs to. */
  section?: string
  /** Conditional visibility: boolean = unconditional; object = ref-by-value. */
  showIf?: boolean | Record<string, unknown>
  /** Grid column span (default full width when omitted). */
  cols?: number
  /** Relative render position; ties preserve declaration order. */
  order?: number
  /** Input placeholder text. */
  placeholder?: string
  /** Help text rendered alongside the input. */
  helpText?: string
  /** For `file` fields: allow multiple file selection. */
  multiple?: boolean
  /** For `file` fields: HTML accept attribute mime filter (e.g. `image/*`). */
  accept?: string
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
  /**
   * Validation rules (mirrors backend FieldValidationSpec). Used by
   * useSpecValidation.buildZodSchema for frontend UX validation. The backend
   * stays authoritative; this is the frontend projection.
   * spec-engine-v2-frontend-and-loader (Slice 3): added.
   */
  validation?: {
    min?: number
    max?: number
    pattern?: string
    email?: boolean
    url?: boolean
  }
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
  /**
   * Titled fieldsets. SpecDataForm groups fields by `field.ui.section` and
   * renders a titled fieldset per section. Fields without a section land in
   * a default trailing group.
   * spec-engine-v2-frontend-and-loader (Slice 3): added.
   */
  sections?: Array<{
    id?: string
    title: string
    icon?: string
    cols?: number
    fields?: string[]
  }>
  /**
   * Wizard steps. When set, SpecDataForm renders a stepper with prev/next
   * navigation and per-step validation. Takes precedence over `tabs` and
   * `sections` for form rendering.
   * spec-engine-v2-frontend-and-loader (Slice 3): added.
   */
  steps?: Array<{
    id?: string
    title: string
    icon?: string
    fields: string[]
    section?: string
  }>
  /**
   * Tabs. SpecDataForm renders one tab per definition, validates only the
   * visible tab on local navigation, and validates ALL tabs on final submit.
   * Takes precedence over `sections` (but `steps` wins over `tabs`).
   * spec-engine-v2-frontend-and-loader (Slice 3): added.
   */
  tabs?: Array<{
    id?: string
    title: string
    icon?: string
    fields: string[]
    section?: string
  }>
  /**
   * Default view for the resource list page. `'table'` renders SpecDataTable
   * (default), `'kanban'` renders SpecKanban, `'list'` renders SpecList.
   * Mirrors backend `ResourceUISpec.view`.
   * spec-engine-v2-frontend-and-loader (Slice 6): added.
   */
  view?: 'table' | 'kanban' | 'list'
  /**
   * Field name whose values define the kanban columns (e.g. `status`).
   * Required when `view === 'kanban'`. When the field is an enum, the enum
   * values are used as columns; otherwise distinct values are derived from
   * the loaded records.
   * Mirrors backend `ResourceUISpec.kanbanColumn`.
   * spec-engine-v2-frontend-and-loader (Slice 6): added.
   */
  kanbanColumn?: string
  /**
   * Field name used to order cards within a kanban column (ascending).
   * Optional. Mirrors backend `ResourceUISpec.kanbanOrder`.
   * spec-engine-v2-frontend-and-loader (Slice 6): added.
   */
  kanbanOrder?: string
}

/**
 * Custom action declaration. Mirrors backend `ActionSpec`
 * (apps/back/src/core/spec-engine/spec.types.ts).
 *
 * spec-engine-v2-frontend-and-loader (Slice 4): added.
 */
export interface ActionInputSpec {
  name: string
  type?: string
  required?: boolean
  ref?: string
}

export interface ActionSpec {
  name: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** Sub-path under the resource, e.g. ':id/assign' or 'bulk/assign' */
  path: string
  auth?: string[]
  input?: ActionInputSpec[]
  /** Backend handler path (internal). The frontend calls the HTTP endpoint. */
  handler?: string
  ui?: {
    label?: string
    icon?: string
    buttonLocation?: 'row' | 'bulk' | 'header'
    confirm?: string
  }
}

/**
 * Export configuration. Mirrors backend `ExportSpec`. The backend does NOT
 * expose an HTTP `/export` endpoint (no route in controller-factory), so the
 * frontend performs client-side export using the currently loaded rows.
 *
 * spec-engine-v2-frontend-and-loader (Slice 4): added.
 */
export interface ExportSpec {
  format: 'csv' | 'json'
  fields?: string[]
  /** Backend handler path (internal) — unused by the frontend. */
  handler?: string
}

/**
 * Import configuration. Mirrors backend `ImportSpec`. The backend does NOT
 * expose an HTTP `/import` endpoint, so the frontend parses the uploaded
 * file and upserts via the standard create/update endpoints.
 *
 * spec-engine-v2-frontend-and-loader (Slice 4): added.
 */
export interface ImportSpec {
  format: 'csv' | 'json'
  mapping?: Record<string, string>
  /** When set, upsert by this key (find existing → update, else create). */
  uniqueKey?: string
  /** Backend handler path (internal) — unused by the frontend. */
  handler?: string
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
  /** Custom actions. spec-engine-v2-frontend-and-loader (Slice 4): added. */
  actions?: ActionSpec[]
  /** Export config. spec-engine-v2-frontend-and-loader (Slice 4): added. */
  exportConfig?: ExportSpec
  /** Import config. spec-engine-v2-frontend-and-loader (Slice 4): added. */
  importConfig?: ImportSpec
}

export interface SpecResponse {
  resources: ResourceSpec[]
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

/**
 * Chart type for a dashboard panel. Mirrors the backend `ChartType`
 * (apps/back/src/core/spec-engine/spec.types.ts): pre-change values
 * stat/donut/bar/line/custom plus spec-engine-v2's `table` and `list`.
 *
 * spec-engine-v2-frontend-and-loader (Slice 5): widened to include `table`
 * and `list` so SpecDashboard can branch on them in its template.
 */
export type PanelChartType = 'stat' | 'donut' | 'bar' | 'line' | 'custom' | 'table' | 'list'

/**
 * A single panel within a dashboard view. Mirrors the backend `PanelSpec`.
 *
 * spec-engine-v2-frontend-and-loader (Slice 5):
 *   - `chart` typed as `PanelChartType` (was loose `string`).
 *   - Added `component?` (custom Vue component name) — mirrors backend.
 *   - Added `span?` and `height?` (layout hints). NOTE: at the time of this
 *     slice, the backend `PanelSpec` interface does NOT yet declare `span`
 *     or `height` (only `component`). They are included here as optional so
 *     the frontend is ready to honor them the moment a spec author adds
 *     them to a panel YAML. When absent, SpecDashboard falls back to the
 *     pre-change defaults (span=4 in a 12-col grid, height=280px). The
 *     backend simply ignores unknown YAML keys, so adding `span`/`height`
 *     to a panel YAML today is harmless forward-compat.
 *   - Added `query?` (QuerySpec projection) so table/list panels can fetch
 *     their own data client-side when the view payload doesn't include it.
 */
export interface DashboardPanel {
  name: string
  chart: PanelChartType
  label?: string
  /** Custom Vue component name (resolved via spec-components registry). */
  component?: string
  /** Grid column span (1-12). Default 4 when omitted. */
  span?: number
  /** Panel height: CSS string ('280px', 'auto', '400px') or number (px). Default '280px'. */
  height?: string | number
  query?: {
    resource: string
    aggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max'
    aggregateField?: string
    groupBy?: string
    groupByInterval?: 'hour' | 'day' | 'week' | 'month'
    timeRange?: string
    filter?: string
    sort?: { field: string; order: 'asc' | 'desc' }
    limit?: number
  }
  data: {
    value?: number
    labels?: string[]
    values?: number[]
    /** Table/list panels: the records to render (array of rows). */
    rows?: Array<Record<string, unknown>>
    /** Table/list panels: the field names to show as columns/inline. */
    fields?: string[]
    [key: string]: unknown
  }
}

/**
 * A dashboard view. Mirrors the backend `ViewSpec`.
 *
 * spec-engine-v2-frontend-and-loader (Slice 5): added `type` (typed, was
 * implicit) and `component?` so SpecDashboard can delegate the entire view
 * to a custom Vue component when `type === 'custom'`.
 */
export interface DashboardData {
  name: string
  displayName?: string
  /** View type. `dashboard` renders the panel grid; `custom` delegates to `component`. */
  type?: 'dashboard' | 'custom'
  /** When type==='custom', the Vue component name to render (via spec-components). */
  component?: string
  panels: DashboardPanel[]
}

/* ------------------------------------------------------------------ *
 * Composable
 * ------------------------------------------------------------------ */

export function useSpecResource() {
  const config = useRuntimeConfig()
  const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`
  const queryClient = useQueryClient()
  const authStore = useAuthStore()

  /** Build common fetch headers with the JWT from the auth store (if present). */
  function authHeaders(): Record<string, string> {
    return authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
  }

  /* ---------------- Spec metadata ---------------- */

  const specQuery = useQuery<Record<string, ResourceSpec>, Error, Record<string, ResourceSpec>>({
    queryKey: ['_spec', 'resources'],
    queryFn: async () => {
      const res = await $fetch<SpecResponse>(`/_spec/resources`, { baseURL, headers: authHeaders() })
      const list = res.resources ?? []
      // Index by both singular name (e.g. 'task') and plural route segment
      // (e.g. 'tasks') so the [resource] route param matches regardless of
      // whether the URL uses the singular or plural form.
      const map: Record<string, ResourceSpec> = {}
      for (const r of list as any[]) {
        if (r?.name) map[r.name] = r
        // Extract the plural segment from the route: '/api/v1/tasks' → 'tasks'
        if (r?.route) {
          const seg = r.route.replace(/\/api\/v\d+\//, '').replace(/^\//, '')
          if (seg) map[seg] = r
        }
      }
      return map
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
    return $fetch<ListResponse<T>>(`/${endpoint}`, { baseURL, query, headers: authHeaders() })
  }

  async function create<T = Record<string, unknown>>(
    resourceName: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const endpoint = endpointFor(resourceName)
    return $fetch<T>(`/${endpoint}`, { baseURL, method: 'POST', body, headers: authHeaders() })
  }

  async function update<T = Record<string, unknown>>(
    resourceName: string,
    id: string | number,
    body: Record<string, unknown>,
  ): Promise<T> {
    const endpoint = endpointFor(resourceName)
    return $fetch<T>(`/${endpoint}/${encodeURIComponent(String(id))}`, {
      baseURL,
      method: 'PATCH',
      body,
      headers: authHeaders(),
    })
  }

  async function remove(
    resourceName: string,
    id: string | number,
  ): Promise<void> {
    const endpoint = endpointFor(resourceName)
    await $fetch(`/${endpoint}/${encodeURIComponent(String(id))}`, {
      baseURL,
      method: 'DELETE',
      headers: authHeaders(),
    })
  }

  async function findOne<T = Record<string, unknown>>(
    resourceName: string,
    id: string | number,
  ): Promise<T> {
    const endpoint = endpointFor(resourceName)
    const res = await $fetch<{ data: T } | T>(`/${endpoint}/${encodeURIComponent(String(id))}`, {
      baseURL,
      headers: authHeaders(),
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

  /**
   * Fetch a dashboard/view by name. Supports optional `timeRange` and
   * `filters` query params for drill-down + time-range selection.
   *
   * spec-engine-v2-frontend-and-loader (Slice 5): the `timeRange` and
   * `filter` params are forwarded as query string params. The backend
   * `/_spec/views/:name` controller may or may not honor them yet — when
   * it doesn't, they are silently ignored (forward-compat). When the
   * backend's `QuerySpec.groupByInterval` is set, the timeRange narrows
   * the grouping window.
   */
  async function fetchView(
    viewName: string,
    opts: { timeRange?: string; filter?: Record<string, string> } = {},
  ): Promise<DashboardData> {
    const query: Record<string, unknown> = {}
    if (opts.timeRange) query.timeRange = opts.timeRange
    if (opts.filter) {
      for (const [k, v] of Object.entries(opts.filter)) {
        if (v !== '' && v != null) query[`filter[${k}]`] = v
      }
    }
    return $fetch<DashboardData>(`/_spec/views/${encodeURIComponent(viewName)}`, { baseURL, query, headers: authHeaders() })
  }

  /**
   * Run a custom action declared in `spec.actions[]`. The backend mounts
   * each action at `/{pluralizedResource}/{action.path}` (e.g.
   * `:id/assign` → `POST /api/v1/tasks/:id/assign`). The frontend calls the
   * HTTP endpoint (the backend `handler` field is internal to the server).
   *
   * `id` is required for row actions (path contains `:id`); omitted for
   * bulk/header actions. `input` is the action input body.
   *
   * spec-engine-v2-frontend-and-loader (Slice 4): added.
   */
  async function runAction(
    resourceName: string,
    action: ActionSpec,
    id?: string | number,
    input: Record<string, unknown> = {},
  ): Promise<unknown> {
    const endpoint = endpointFor(resourceName)
    const actionPath = action.path.startsWith('/') ? action.path.slice(1) : action.path
    const resolvedPath = actionPath.replace(':id', id != null ? encodeURIComponent(String(id)) : ':id')
    return $fetch<unknown>(`/${endpoint}/${resolvedPath}`, {
      baseURL,
      method: action.method || 'POST',
      body: input,
      headers: authHeaders(),
    })
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

  /**
   * TanStack Query wrapper for `fetchView`. Supports optional `timeRange`
   * and `filter` (drill-down) via reactive getter args.
   *
   * spec-engine-v2-frontend-and-loader (Slice 5): the args getter now
   * accepts an options object `{ timeRange?, filter? }`. The queryKey
   * includes them so changing the time-range or a drill-down filter
   * refetches automatically.
   */
  function useViewQuery(
    viewName: MaybeRefOrGetter<string>,
    args: MaybeRefOrGetter<{ timeRange?: string; filter?: Record<string, string> }> = {},
  ) {
    return useQuery({
      queryKey: () => ['spec', 'view', toValue(viewName), toValue(args)],
      queryFn: () => fetchView(toValue(viewName), toValue(args)),
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
    runAction,
    useListQuery,
    useFindOneQuery,
    useCreateMutation,
    useUpdateMutation,
    useRemoveMutation,
    useRefOptionsQuery,
    useViewQuery,
  }
}
