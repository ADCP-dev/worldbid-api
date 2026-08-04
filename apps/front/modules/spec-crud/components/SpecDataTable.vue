<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { type FieldSpec, type ActionSpec, type ExportSpec, type ImportSpec, refResource } from '../composables/useSpecResource'
import { useSpecActions } from '../composables/useSpecActions'
import { useRefResolver } from '../composables/useRefResolver'
import SpecFieldRenderer from './SpecFieldRenderer.vue'
import SortableHeader from '@base/ui-app/components/data-table/filters/SortableHeader.vue'
import DataTableComboboxFilter from '@base/ui-app/components/data-table/filters/DataTableComboboxFilter.vue'
import EditButton from '@base/ui-app/components/data-table/buttons/EditButton.vue'
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue'
import ViewButton from '@base/ui-app/components/data-table/buttons/ViewButton.vue'
import type { MyColumnDef } from '@base/ui-app/components/data-table/types'

/* ------------------------------------------------------------------ *
 * SpecDataTable — spec-driven list view.
 *
 * spec-engine-v2-frontend-and-loader (Slice 4):
 *   - SortableHeader wired to the existing sort/order refs (toggle on reclick)
 *   - DataTableComboboxFilter wired to filterable columns
 *   - Bulk select (checkbox column + select-all respecting current filter)
 *   - Custom row/bulk/header actions via useSpecActions + useSpecResource.runAction
 *   - Export (client-side CSV/JSON) + Import (parse file → upsert via create/update)
 *   - Row click navigates to /{resource}/{id} (action clicks do not navigate)
 *   - Column toggle/hide with localStorage persistence per resource
 *   - Per-page selector (10/25/50/100) + responsive card view on small screens
 *
 * The base DataTable.vue component owns its own tableStateStore and search
 * box; SpecDataTable needs fine-grained control over sort/filter/selection/
 * actions/export/import/column-toggle/manual pagination, so it renders its
 * own table using the base sub-components (SortableHeader, filters, buttons).
 * No new base components are created — only existing ones are reused.
 * ------------------------------------------------------------------ */

const props = defineProps<{
  /** Resource name */
  resource: string
}>()

const specCrud = useSpecResource()
const { useListQuery, useRemoveMutation, runAction, create, update } = specCrud
const { preloadRefs } = useRefResolver()

/* ---------------- Spec + actions partition ---------------- */

const spec = specCrud.getResource(props.resource)
const primaryKey = computed(() => spec.value?.primaryKey ?? 'id')

const { rowActions, bulkActions, headerActions } = useSpecActions(spec)

/* Preload ref resources so ref fields render as avatars/labels. */
watch(
  () => spec.value,
  (s) => {
    if (!s) return
    preloadRefs(s.fields.filter((f) => !!refResource(f)))
  },
  { immediate: true },
)

/* ---------------- Reactive query state ---------------- */

const search = ref('')
const sort = ref<string | undefined>(undefined)
const order = ref<'asc' | 'desc' | undefined>(undefined)
const page = ref(1)
const limit = ref(10)
const filters = ref<Record<string, unknown>>({})

const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const

const listParams = computed(() => ({
  page: page.value,
  limit: limit.value,
  search: search.value || undefined,
  sort: sort.value,
  order: order.value,
  filter: { ...filters.value },
}))

const { data: listResponse, isLoading: loading, error, refetch } = useListQuery(
  () => props.resource,
  listParams,
)

const rows = computed(() => listResponse.value?.data ?? [])
const total = computed(() => listResponse.value?.total ?? listResponse.value?.meta?.total ?? 0)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

/* ---------------- Field selection ---------------- */

const listFields = computed<FieldSpec[]>(() => {
  if (!spec.value) return []
  const names = spec.value.ui?.listFields
  if (names && names.length) {
    return names
      .map((n) => spec.value!.fields.find((f) => f.name === n))
      .filter((f): f is FieldSpec => !!f)
  }
  // Default: all fields except the primary key. Ref fields without an
  // explicit display hint are included — SpecFieldRenderer shows them
  // as "#ID" badges, which is preferable to hiding them.
  return spec.value.fields.filter((f) => f.name !== primaryKey.value)
})

/* ---------------- Permissions ---------------- */

const canCreate = computed(() => {
  const perms = spec.value?.permissions
  if (!perms || !perms.create) return true
  return perms.create.length > 0 || true
})

const canUpdate = computed(() => {
  const perms = spec.value?.permissions
  if (!perms || !perms.update) return true
  return true
})

const canDelete = computed(() => {
  const perms = spec.value?.permissions
  if (!perms || !perms.delete) return true
  return true
})

/* ---------------- Column toggle / hide (localStorage per resource) ---------------- */

const HIDDEN_KEY = computed(() => `spec-crud:hidden-columns:${props.resource}`)

const hiddenColumns = ref<Set<string>>(loadHidden())

function loadHidden(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY.value)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (Array.isArray(arr)) return new Set(arr.filter((v): v is string => typeof v === 'string'))
  } catch {
    // corrupt entry — ignore
  }
  return new Set()
}

function persistHidden() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HIDDEN_KEY.value, JSON.stringify([...hiddenColumns.value]))
  } catch {
    // storage full / disabled — non-fatal
  }
}

function toggleColumn(name: string) {
  const next = new Set(hiddenColumns.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  hiddenColumns.value = next
  persistHidden()
}

const visibleListFields = computed<FieldSpec[]>(() =>
  listFields.value.filter((f) => !hiddenColumns.value.has(f.name)),
)

/* ---------------- Filter wiring ---------------- */

function filterTypeFor(field: FieldSpec): MyColumnDef<unknown, unknown>['filterType'] {
  if (field.ui?.filterable === false) return undefined
  const explicit = field.ui?.filterType
  if (explicit) {
    if (explicit === 'text') return 'string'
    if (explicit === 'select') return 'select'
    if (explicit === 'dateRange') return 'date'
    if (explicit === 'boolean') return 'boolean'
  }
  switch (field.type) {
    case 'integer':
    case 'decimal':
    case 'float':
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'date':
    case 'datetime':
      return 'date'
    case 'enum':
      return 'select'
    default:
      return field.ui?.filterable ? 'string' : undefined
  }
}

function filterOptionsFor(field: FieldSpec): Array<{ value: string | number; label: string }> | undefined {
  if (!field.enum || !field.enum.length) return undefined
  return field.enum.map((v) => ({ value: v, label: String(v) }))
}

function setFilter(name: string, value: unknown) {
  const next: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(filters.value)) {
    if (k !== name) next[k] = v
  }
  if (value !== '' && value !== null && value !== undefined) {
    next[name] = value
  }
  filters.value = next
  page.value = 1
}

function clearFilters() {
  filters.value = {}
  page.value = 1
}

const activeFilterCount = computed(
  () => Object.keys(filters.value).filter((k) => filters.value[k] !== '' && filters.value[k] != null).length,
)

/* ---------------- Sort wiring ---------------- */

function onSortChange(field: string) {
  if (sort.value === field) {
    if (order.value === 'asc') order.value = 'desc'
    else if (order.value === 'desc') {
      // third click clears
      sort.value = undefined
      order.value = undefined
    } else order.value = 'asc'
  } else {
    sort.value = field
    order.value = 'asc'
  }
  page.value = 1
}

function sortIcon(field: string): 'asc' | 'desc' | null {
  if (sort.value !== field) return null
  return order.value === 'asc' ? 'asc' : order.value === 'desc' ? 'desc' : null
}

/* ---------------- Bulk selection ---------------- */

const selected = ref<Set<string>>(new Set())

function rowId(row: Record<string, unknown>): string {
  return String(row[primaryKey.value] ?? '')
}

const allVisibleSelected = computed(
  () => rows.value.length > 0 && rows.value.every((r) => selected.value.has(rowId(r))),
)

const someVisibleSelected = computed(
  () => rows.value.some((r) => selected.value.has(rowId(r))) && !allVisibleSelected.value,
)

function toggleRow(row: Record<string, unknown>) {
  const id = rowId(row)
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleAllVisible() {
  const next = new Set(selected.value)
  if (allVisibleSelected.value) {
    // deselect only the visible rows
    for (const r of rows.value) next.delete(rowId(r))
  } else {
    for (const r of rows.value) next.add(rowId(r))
  }
  selected.value = next
}

function clearSelection() {
  selected.value = new Set()
}

const selectedIds = computed<string[]>(() => [...selected.value])

/* ---------------- Row click navigation ---------------- */

function onRowClick(row: Record<string, unknown>, event: MouseEvent) {
  // Disambiguate row-click vs action/checkbox click: if the click target is
  // inside an element marked with `data-action`, do not navigate.
  const target = event.target as HTMLElement | null
  if (target && target.closest('[data-action]')) return
  const id = rowId(row)
  navigateTo(`/app/${props.resource}/${id}`)
}

/* ---------------- Custom actions ---------------- */

async function executeAction(action: ActionSpec, ids: string[]) {
  if (action.ui?.confirm) {
    const count = ids.length
    const msg = action.ui.confirm
      .replace('{count}', String(count))
      .replace('{ids}', ids.join(', '))
    if (!window.confirm(msg)) return
  }
  try {
    if (action.ui?.buttonLocation === 'row') {
      // Row action: id is required (path contains :id)
      await runAction(props.resource, action, ids[0])
    } else {
      // Bulk/header action: pass all selected ids in the body
      await runAction(props.resource, action, undefined, { ids })
    }
    // Invalidate the list query so the table refetches after the action runs
    refetch()
  } catch {
    // surfaced via toast/query error handling
  }
}

async function executeBulkAction(action: ActionSpec) {
  if (selected.value.size === 0) return
  await executeAction(action, selectedIds.value)
}

/* ---------------- Export (client-side) ---------------- */

const exportConfig = computed<ExportSpec | undefined>(() => spec.value?.exportConfig)

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function toCsv(fields: string[], data: Array<Record<string, unknown>>): string {
  const needsQuoting = (s: string): boolean => /[",\n\r]/.test(s)
  const escapeCell = (s: string): string =>
    needsQuoting(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  const formatCell = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') {
      try { return JSON.stringify(value) } catch { return String(value) }
    }
    return String(value)
  }
  const lines: string[] = []
  lines.push(fields.map(escapeCell).join(','))
  for (const row of data) {
    lines.push(fields.map((f) => escapeCell(formatCell(row[f]))).join(','))
  }
  return lines.join('\n')
}

function exportFields(): string[] {
  // Hidden columns are excluded from export (spec scenario).
  const base = exportConfig.value?.fields && exportConfig.value.fields.length > 0
    ? exportConfig.value.fields
    : visibleListFields.value.map((f) => f.name)
  return base.filter((n) => !hiddenColumns.value.has(n))
}

function onExport() {
  const fields = exportFields()
  if (!fields.length) return
  const data = rows.value.map((r) => {
    const out: Record<string, unknown> = {}
    for (const f of fields) out[f] = r[f]
    return out
  })
  const fmt = exportConfig.value?.format ?? 'csv'
  const stamp = new Date().toISOString().slice(0, 10)
  if (fmt === 'json') {
    downloadFile(`${props.resource}-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json')
  } else {
    downloadFile(`${props.resource}-${stamp}.csv`, toCsv(fields, data), 'text/csv')
  }
}

/* ---------------- Import (client-side parse → upsert) ---------------- */

const importConfig = computed<ImportSpec | undefined>(() => spec.value?.importConfig)
const importing = ref(false)
const importInputRef = ref<HTMLInputElement | null>(null)

function parseCsv(text: string): Array<Record<string, unknown>> {
  // Minimal RFC-4180-ish CSV parser: handles quoted fields, doubled quotes,
  // commas and newlines inside quotes. Sufficient for import round-tripping
  // the export output above.
  const rows: Array<Record<string, unknown>> = []
  let i = 0
  const n = text.length
  const parseLine = (): string[] | null => {
    if (i >= n) return null
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    while (i < n) {
      const ch = text[i]
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { current += '"'; i += 2; continue }
          inQuotes = false; i += 1; continue
        }
        current += ch; i += 1; continue
      }
      if (ch === '"') { inQuotes = true; i += 1; continue }
      if (ch === ',') { cells.push(current); current = ''; i += 1; continue }
      if (ch === '\r') { i += 1; continue }
      if (ch === '\n') { cells.push(current); return cells }
      current += ch; i += 1
    }
    cells.push(current)
    return cells
  }
  let header: string[] | null = null
  let line = parseLine()
  while (line !== null) {
    if (!header) {
      header = line
    } else if (line.length === 1 && line[0] === '' && i >= n) {
      // trailing empty line — skip
    } else {
      const row: Record<string, unknown> = {}
      for (let c = 0; c < (header?.length ?? 0); c++) {
        const key = header?.[c] ?? `col${c}`
        row[key] = line[c] ?? ''
      }
      rows.push(row)
    }
    line = parseLine()
  }
  return rows
}

function applyMapping(row: Record<string, unknown>, mapping?: Record<string, string>): Record<string, unknown> {
  if (!mapping) return row
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const target = mapping[k] ?? k
    out[target] = v
  }
  return out
}

async function onImportFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  importing.value = true
  try {
    const text = await file.text()
    const fmt = importConfig.value?.format ?? 'csv'
    let parsed: Array<Record<string, unknown>> = []
    if (fmt === 'json') {
      parsed = JSON.parse(text) as Array<Record<string, unknown>>
    } else {
      parsed = parseCsv(text)
    }
    const mapping = importConfig.value?.mapping
    const uniqueKey = importConfig.value?.uniqueKey
    let created = 0
    let updated = 0
    const errors: string[] = []
    for (let idx = 0; idx < parsed.length; idx++) {
      try {
        const mapped = applyMapping(parsed[idx], mapping)
        if (uniqueKey && mapped[uniqueKey] != null) {
          // Find existing via list query with filter on uniqueKey — simplest
          // path is to attempt an update and fall back to create on 404. We
          // don't have a generic "findOne by field" endpoint, so we try the
          // update endpoint directly with the uniqueKey value as the id.
          try {
            await update(props.resource, String(mapped[uniqueKey]), mapped)
            updated++
          } catch {
            await create(props.resource, mapped)
            created++
          }
        } else {
          await create(props.resource, mapped)
          created++
        }
      } catch (err) {
        errors.push(`Row ${idx}: ${(err as Error).message ?? String(err)}`)
      }
    }
    const summary = `Imported: ${created} created, ${updated} updated${errors.length ? `, ${errors.length} errors` : ''}`
    if (errors.length && created === 0 && updated === 0) {
      window.alert(`Import failed.\n${summary}\nFirst error: ${errors[0]}`)
    } else {
      window.alert(summary)
    }
    refetch()
  } catch (err) {
    window.alert(`Import error: ${(err as Error).message ?? String(err)}`)
  } finally {
    importing.value = false
    if (importInputRef.value) importInputRef.value.value = ''
  }
}

/* ---------------- Delete ---------------- */

const removeMutation = useRemoveMutation(() => props.resource)

async function handleDelete(row: Record<string, unknown>) {
  const id = rowId(row)
  if (!confirm(`Delete record #${id}?`)) return
  try {
    await removeMutation.mutateAsync(id)
    selected.value.delete(id)
  } catch {
    // mutation errors surface via toast / query error handling
  }
}

/* ---------------- Search debounce ---------------- */

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
  }, 300)
})

/* ---------------- Responsive: card view on small screens ---------------- */

const isMobile = ref(false)
function updateBreakpoint() {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth < 768
}
onMounted(() => {
  updateBreakpoint()
  window.addEventListener('resize', updateBreakpoint)
})

/* ---------------- Helpers ---------------- */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
</script>

<template>
  <div class="w-full">
    <!-- Header bar -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <h2 class="text-xl font-semibold flex-1 text-base-content">
        {{ spec?.ui?.plural ?? resource }}
      </h2>

      <input
        v-model="search"
        type="text"
        class="input input-bordered input-sm w-64"
        placeholder="Search…"
      >

      <!-- Export -->
      <button
        v-if="exportConfig"
        class="btn btn-outline btn-sm"
        data-action="export"
        @click="onExport"
      >
        Export
      </button>

      <!-- Import -->
      <label
        v-if="importConfig"
        class="btn btn-outline btn-sm"
        data-action="import"
        :class="{ 'loading': importing }"
      >
        Import
        <input
          ref="importInputRef"
          type="file"
          class="hidden"
          :accept="importConfig.format === 'json' ? '.json' : '.csv'"
          @change="onImportFile"
        >
      </label>

      <!-- Custom header actions (always visible) -->
      <button
        v-for="action in headerActions"
        :key="action.spec.name"
        class="btn btn-sm"
        :class="{ 'btn-primary': action.spec.method === 'POST', 'btn-outline': action.spec.method !== 'POST' }"
        data-action="header-action"
        @click="executeAction(action.spec, selectedIds)"
      >
        {{ action.label }}
      </button>

      <NuxtLink
        v-if="canCreate"
        :to="`/app/${resource}/new`"
        class="btn btn-primary btn-sm"
      >
        + New
      </NuxtLink>
    </div>

    <!-- Bulk toolbar (visible when selection > 0) -->
    <div
      v-if="selected.size > 0"
      class="flex flex-wrap items-center gap-3 mb-4 p-3 bg-base-200 rounded-lg"
    >
      <span class="text-sm font-medium">
        {{ selected.size }} selected
      </span>
      <button
        class="btn btn-ghost btn-xs"
        data-action="clear-selection"
        @click="clearSelection"
      >
        Clear
      </button>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="action in bulkActions"
          :key="action.spec.name"
          class="btn btn-sm"
          :class="{ 'btn-primary': action.spec.method === 'POST', 'btn-outline': action.spec.method !== 'POST' }"
          data-action="bulk-action"
          @click="executeBulkAction(action.spec)"
        >
          {{ action.label }}
        </button>
      </div>
    </div>

    <!-- Error banner -->
    <div v-if="error" class="alert alert-error mb-4">
      <span>{{ error.message || 'Failed to load data' }}</span>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading && !rows.length" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!loading && !rows.length"
      class="text-center py-12 text-base-content/50"
    >
      <div class="flex flex-col items-center gap-2">
        <svg class="w-12 h-12 text-base-content/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 3v18" />
        </svg>
        <p>No records found.</p>
      </div>
    </div>

    <!-- Mobile: card view -->
    <div v-else-if="isMobile" class="space-y-3">
      <div
        v-for="row in rows"
        :key="rowId(row)"
        class="card bg-base-100 shadow-sm border border-base-200 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
        @click="(e) => onRowClick(row, e)"
      >
        <div class="card-body p-3 gap-1.5">
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              data-action="select-row"
              :checked="selected.has(rowId(row))"
              @change="toggleRow(row)"
            >
            <span class="font-semibold flex-1 truncate text-sm">
              {{ row[visibleListFields[0]?.name ?? primaryKey] ?? rowId(row) }}
            </span>
            <div class="flex items-center gap-1" data-action="row-buttons">
              <ViewButton
                v-if="canUpdate"
                :aria-label="`View ${rowId(row)}`"
                @click="navigateTo(`/app/${resource}/${rowId(row)}`)"
              />
              <EditButton
                v-if="canUpdate"
                @click="navigateTo(`/app/${resource}/${rowId(row)}`)"
              />
              <DeleteButton
                v-if="canDelete"
                @click="handleDelete(row)"
              />
              <button
                v-for="action in rowActions"
                :key="action.spec.name"
                class="btn btn-ghost btn-xs"
                data-action="row-action"
                @click="executeAction(action.spec, [rowId(row)])"
              >
                {{ action.label }}
              </button>
            </div>
          </div>
          <div
            v-for="field in visibleListFields.slice(1)"
            :key="field.name"
            class="text-sm flex items-center gap-1.5"
          >
            <span class="text-xs text-base-content/50">{{ field.label ?? capitalize(field.name) }}:</span>
            <SpecFieldRenderer :value="row[field.name]" :field="field" :row="row" />
          </div>
        </div>
      </div>
    </div>

    <!-- Desktop: table view -->
    <div v-else class="card bg-base-100 border border-base-200 rounded-lg shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <!-- Header row with sort -->
            <tr class="border-b border-base-200">
              <th class="w-10 bg-base-200/50">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  data-action="select-all"
                  :checked="allVisibleSelected"
                  :indeterminate.prop="someVisibleSelected"
                  @change="toggleAllVisible"
                >
              </th>
              <th
                v-for="field in visibleListFields"
                :key="field.name"
                class="bg-base-200/50 text-xs font-medium text-base-content/60 uppercase tracking-wider"
              >
                <SortableHeader
                  v-if="field.sortable"
                  :column="{ getIsSorted: () => sortIcon(field.name) } as any"
                  :label="field.label ?? capitalize(field.name)"
                  data-action="sort"
                  @click="onSortChange(field.name)"
                />
                <span v-else>{{ field.label ?? capitalize(field.name) }}</span>
                <button
                  v-if="sortIcon(field.name) === 'asc'"
                  class="btn btn-ghost btn-xs px-1"
                  data-action="sort"
                  @click="onSortChange(field.name)"
                >▲</button>
                <button
                  v-else-if="sortIcon(field.name) === 'desc'"
                  class="btn btn-ghost btn-xs px-1"
                  data-action="sort"
                  @click="onSortChange(field.name)"
                >▼</button>
              </th>
              <th
                v-if="canUpdate || canDelete || rowActions.length"
                class="bg-base-200/50 text-xs font-medium text-base-content/60 uppercase tracking-wider text-right"
              >
                Actions
              </th>
            </tr>
          <!-- Filter row -->
          <tr>
            <th />
            <th
              v-for="field in visibleListFields"
              :key="field.name"
              class="py-1"
            >
              <template v-if="filterTypeFor(field) === 'number'">
                <input
                  type="number"
                  class="input input-sm input-bordered w-full max-w-xs font-normal"
                  :placeholder="`Filter by ${field.label ?? field.name}`"
                  :value="String(filters[field.name] ?? '')"
                  data-action="filter"
                  @input="(e) => setFilter(field.name, (e.target as HTMLInputElement).value === '' ? '' : Number((e.target as HTMLInputElement).value))"
                >
              </template>
              <template v-else-if="filterTypeFor(field) === 'date'">
                <input
                  type="date"
                  class="input input-sm input-bordered w-full max-w-xs font-normal"
                  :value="String(filters[field.name] ?? '')"
                  data-action="filter"
                  @input="(e) => setFilter(field.name, (e.target as HTMLInputElement).value)"
                >
              </template>
              <DataTableComboboxFilter
                v-else-if="filterTypeFor(field) === 'select' && filterOptionsFor(field)"
                :model-value="(filters[field.name] as string | number) ?? ''"
                :options="filterOptionsFor(field)!"
                :placeholder="`Filter by ${field.label ?? field.name}`"
                data-action="filter"
                @update:model-value="(val) => setFilter(field.name, val)"
              />
              <select
                v-else-if="filterTypeFor(field) === 'boolean'"
                :value="String(filters[field.name] ?? '')"
                class="select select-sm select-bordered w-full max-w-xs font-normal"
                data-action="filter"
                @change="(e) => {
                  const v = (e.target as HTMLSelectElement).value
                  if (v === '') setFilter(field.name, '')
                  else if (v === 'true') setFilter(field.name, true)
                  else setFilter(field.name, false)
                }"
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              <input
                v-else-if="filterTypeFor(field) === 'string'"
                type="text"
                class="input input-sm input-bordered w-full max-w-xs font-normal"
                :placeholder="`Filter by ${field.label ?? field.name}`"
                :value="String(filters[field.name] ?? '')"
                data-action="filter"
                @input="(e) => setFilter(field.name, (e.target as HTMLInputElement).value)"
              >
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td :colspan="visibleListFields.length + 2" class="h-24 text-center text-base-content/50">
              <div class="flex flex-col items-center gap-2">
                <svg class="w-10 h-10 text-base-content/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 3v18" />
                </svg>
                <span>No results.</span>
              </div>
            </td>
          </tr>
          <tr
            v-for="(row, rowIndex) in rows"
            :key="rowId(row)"
            :class="['hover cursor-pointer h-14', rowIndex % 2 === 1 ? 'bg-base-200/30' : '']"
            @click="(e) => onRowClick(row, e)"
          >
            <td data-action="select-row" @click.stop class="align-middle">
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                :checked="selected.has(rowId(row))"
                @change="toggleRow(row)"
              >
            </td>
            <td v-for="field in visibleListFields" :key="field.name" class="align-middle px-4 py-2">
              <SpecFieldRenderer :value="row[field.name]" :field="field" :row="row" />
            </td>
            <td class="text-right align-middle" data-action="row-buttons" @click.stop>
              <div class="flex items-center justify-end gap-1">
                <ViewButton
                  v-if="canUpdate"
                  :aria-label="`View ${rowId(row)}`"
                  @click="navigateTo(`/app/${resource}/${rowId(row)}`)"
                />
                <EditButton
                  v-if="canUpdate"
                  @click="navigateTo(`/app/${resource}/${rowId(row)}`)"
                />
                <DeleteButton
                  v-if="canDelete"
                  @click="handleDelete(row)"
                />
                <button
                  v-for="action in rowActions"
                  :key="action.spec.name"
                  class="btn btn-ghost btn-xs"
                  data-action="row-action"
                  @click="executeAction(action.spec, [rowId(row)])"
                >
                  {{ action.label }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <!-- Footer: count + pagination + per-page + column toggle -->
    <div class="flex flex-wrap items-center justify-between gap-3 py-4">
      <div class="text-sm opacity-70">
        Showing {{ total === 0 ? 0 : (page - 1) * limit + 1 }}–{{ Math.min(page * limit, total) }} of {{ total }}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <!-- Column toggle dropdown -->
        <div class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-outline btn-sm">
            Columns
          </label>
          <ul tabindex="0" class="dropdown-content z-[2] menu p-2 shadow bg-base-100 rounded-box w-52 mt-1">
            <li v-for="field in listFields" :key="field.name">
              <label class="cursor-pointer label justify-start gap-2">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  :checked="!hiddenColumns.has(field.name)"
                  data-action="column-toggle"
                  @change="toggleColumn(field.name)"
                >
                <span class="label-text">{{ field.label ?? capitalize(field.name) }}</span>
              </label>
            </li>
          </ul>
        </div>

        <!-- Per-page selector -->
        <select
          v-model.number="limit"
          class="select select-bordered select-sm w-[120px] font-normal"
          data-action="per-page"
          @change="page = 1"
        >
          <option v-for="size in PER_PAGE_OPTIONS" :key="size" :value="size">
            {{ size }} / page
          </option>
        </select>

        <!-- Pagination -->
        <button
          class="btn btn-outline btn-sm"
          :disabled="page <= 1"
          data-action="pagination"
          @click="page = 1"
        >«</button>
        <button
          class="btn btn-outline btn-sm"
          :disabled="page <= 1"
          data-action="pagination"
          @click="page = Math.max(1, page - 1)"
        >‹</button>
        <span class="text-sm px-2">{{ page }} / {{ pageCount }}</span>
        <button
          class="btn btn-outline btn-sm"
          :disabled="page >= pageCount"
          data-action="pagination"
          @click="page = Math.min(pageCount, page + 1)"
        >›</button>
        <button
          class="btn btn-outline btn-sm"
          :disabled="page >= pageCount"
          data-action="pagination"
          @click="page = pageCount"
        >»</button>
      </div>
    </div>

    <!-- Active filter chips -->
    <div v-if="activeFilterCount > 0" class="flex flex-wrap items-center gap-2 pb-4">
      <span class="text-sm opacity-60">Active filters:</span>
      <template v-for="field in visibleListFields" :key="`chip-${field.name}`">
        <span
          v-if="filters[field.name] !== undefined && filters[field.name] !== '' && filters[field.name] != null"
          class="badge badge-sm gap-1 badge-primary"
        >
          {{ field.label ?? capitalize(field.name) }}: {{ String(filters[field.name]) }}
          <button
            class="ml-1 hover:opacity-100"
            data-action="clear-filter"
            @click="setFilter(field.name, '')"
          >×</button>
        </span>
      </template>
      <button
        class="btn btn-ghost btn-xs"
        data-action="clear-filters"
        @click="clearFilters"
      >
        Clear all
      </button>
    </div>
  </div>
</template>