<script setup lang="ts">
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import Kanban from '@base/ui-app/components/kanban/Kanban.vue'
import type {
  KanbanTask,
  KanbanStateConfig,
} from '@base/ui-app/components/kanban/types'
import type { FieldSpec } from '../composables/useSpecResource'

/* ------------------------------------------------------------------ *
 * SpecKanban — spec-driven kanban view.
 *
 * spec-engine-v2-frontend-and-loader (Slice 6):
 *   - Reuses the base `@base/ui-app/kanban/Kanban.vue` component (NO new
 *     base component created).
 *   - Columns are derived from the field named by `ResourceUISpec.kanbanColumn`.
 *     When the field is an enum, the enum values are used as columns
 *     (preserving declaration order); otherwise columns come from the
 *     distinct values of the loaded records.
 *   - Card order within a column follows `ResourceUISpec.kanbanOrder`
 *     (ascending; ties preserve load order).
 *   - Drag & drop is PESSIMISTIC (design Q3 resolution): on drop, the
 *     component calls the update API; on success it refetches the list
 *     so server-side ordering/column is authoritative; on failure it
 *     refetches to revert the visual move and surfaces a toast. No
 *     optimistic state is held — the base Kanban's local cards are
 *     reconciled from props on every refetch.
 *   - Card click navigates to the detail view `/{resource}/{id}`.
 *   - Card title uses `labelField` (first string-ish field) and the
 *     description uses the first text/truncate field if present.
 * ------------------------------------------------------------------ */

const props = defineProps<{
  /** Resource name */
  resource: string
}>()

const specCrud = useSpecResource()
const { useListQuery, update, refetch: _refetchAlias } = (() => {
  // destructure for clarity; refetch alias unused (we use listQuery.refetch)
  return { useListQuery: specCrud.useListQuery, update: specCrud.update, refetch: specCrud.useListQuery }
})()

const spec = specCrud.getResource(props.resource)
const primaryKey = computed(() => spec.value?.primaryKey ?? 'id')

/* ---------------- Kanban field resolution ---------------- */

/**
 * The field whose values define the kanban columns. Required when
 * `ui.view === 'kanban'`. Falls back to 'status' when omitted (matches
 * the canonical tasks example) but renders a visible warning.
 */
const columnField = computed<string | undefined>(() => spec.value?.ui?.kanbanColumn)

const orderField = computed<string | undefined>(() => spec.value?.ui?.kanbanOrder)

const columnFieldSpec = computed<FieldSpec | undefined>(() => {
  if (!spec.value || !columnField.value) return undefined
  return spec.value.fields.find((f) => f.name === columnField.value)
})

/* ---------------- Card fields ---------------- */

/**
 * Field used as the card title. Resolution order:
 *   1. `ui.labelField` on the column field (legacy hint)
 *   2. a field named `title`
 *   3. the first string/text field with display 'text' or no display
 *   4. the primary key
 */
const titleField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  const fields = spec.value.fields
  // 1. ui.labelField
  const labelName = columnFieldSpec.value?.ui?.labelField
  if (labelName) {
    const f = fields.find((x) => x.name === labelName)
    if (f) return f
  }
  // 2. explicit 'title'
  const t = fields.find((x) => x.name === 'title')
  if (t) return t
  // 3. first string/text field
  const strField = fields.find(
    (x) => x.type === 'string' || x.type === 'text',
  )
  if (strField) return strField
  // 4. primary key
  return fields.find((x) => x.name === primaryKey.value) ?? fields[0]
})

/**
 * Field used as the card description (tooltip/preview). First text/truncate
 * field that is NOT the title field.
 */
const descriptionField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  return spec.value.fields.find(
    (f) =>
      f.name !== titleField.value?.name &&
      (f.type === 'text' || f.ui?.display === 'truncate'),
  )
})

/* ---------------- List query ---------------- */

// Load all records (large limit) so the kanban can group them. Pagination
// of a kanban board is unusual; we load up to 200 records and let the
// columns scroll. The query is filterable on the column field by the
// backend when needed (not wired here — kanban shows all).
const limit = ref(200)

const listParams = computed(() => ({
  limit: limit.value,
  sort: orderField.value,
  order: 'asc' as const,
}))

const { data: listResponse, isLoading: loading, error, refetch } = useListQuery(
  () => props.resource,
  listParams,
)

const rows = computed(() => listResponse.value?.data ?? [])

/* ---------------- Column resolution ---------------- */

/**
 * Build the column (state) list. When the column field is an enum, use
 * the enum values in declaration order. Otherwise derive distinct
 * values from the loaded records (sorted by first appearance).
 *
 * The color hint comes from `columnFieldSpec.ui.colors[value]` when
 * present (the spec uses hex strings; we map a small set of known hex
 * values to the base Kanban color tokens, and fall back to 'neutral').
 */
const HEX_COLOR_MAP: Record<string, string> = {
  '#f59e0b': 'warning',
  '#3b82f6': 'info',
  '#8b5cf6': 'primary',
  '#22c55e': 'success',
  '#ef4444': 'error',
  '#6b7280': 'neutral',
}

function colorFor(value: string): string | undefined {
  const colors = columnFieldSpec.value?.ui?.colors
  if (!colors) return undefined
  const hex = colors[value]
  if (!hex) return undefined
  // normalize hex → token when known
  const key = hex.toLowerCase()
  return HEX_COLOR_MAP[key] ?? 'neutral'
}

function titleCaseValue(s: string): string {
  return s
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

const columns = computed<KanbanStateConfig[]>(() => {
  if (!columnField.value) return []
  const field = columnFieldSpec.value
  if (field?.enum && field.enum.length) {
    return field.enum.map((value, idx) => ({
      id: String(value),
      title: titleCaseValue(String(value)),
      order: idx,
      color: colorFor(String(value)),
    }))
  }
  // distinct values from loaded records, in first-appearance order
  const seen = new Set<string>()
  const out: KanbanStateConfig[] = []
  let order = 0
  for (const row of rows.value) {
    const v = row[columnField.value]
    if (v === null || v === undefined) continue
    const key = String(v)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: key,
      title: titleCaseValue(key),
      order: order++,
      color: colorFor(key),
    })
  }
  return out
})

/* ---------------- Record → KanbanTask adapter ---------------- */

function rowValue(row: Record<string, unknown>, field: FieldSpec | undefined): unknown {
  if (!field) return undefined
  return row[field.name]
}

const tasks = computed<KanbanTask[]>(() => {
  if (!columnField.value) return []
  const tField = titleField.value
  const dField = descriptionField.value
  return rows.value.map((row) => {
    const id = String(row[primaryKey.value] ?? '')
    const titleVal = rowValue(row, tField)
    const descVal = rowValue(row, dField)
    const stateVal = row[columnField.value]
    return {
      id,
      title: titleVal === null || titleVal === undefined ? id : String(titleVal),
      description: descVal === null || descVal === undefined ? undefined : String(descVal),
      stateId: stateVal === null || stateVal === undefined ? '' : String(stateVal),
      metadata: { ...row },
    } satisfies KanbanTask
  })
})

/* ---------------- Drag & drop (PESSIMISTIC) ---------------- */

/**
 * Snapshot of tasks before a drag, used to restore the visual state
 * immediately while the API call is in flight. We don't actually mutate
 * this — the base Kanban keeps its own local cards; on failure we
 * trigger a refetch which resyncs props → local cards.
 */
const dragInFlight = ref(false)

async function onUpdateTaskState(payload: {
  taskId: string
  newStateId: string
  oldStateId: string
}) {
  if (!columnField.value) return
  const { taskId, newStateId, oldStateId } = payload
  dragInFlight.value = true
  try {
    await update(props.resource, taskId, {
      [columnField.value]: newStateId,
    })
    // success: refetch so server ordering is authoritative
    await refetch()
    toast.success('Moved', {
      description: `${titleCaseValue(oldStateId)} → ${titleCaseValue(newStateId)}`,
    })
  } catch (err: unknown) {
    // failure: refetch to REVERT the visual move (pessimistic — the base
    // Kanban already moved the card locally; refetching resyncs from the
    // server, which still has the old column).
    await refetch()
    const msg = err instanceof Error ? err.message : 'Move failed'
    toast.error('Could not move card', { description: msg })
  } finally {
    dragInFlight.value = false
  }
}

/* ---------------- Card click → detail ---------------- */

function onClickTask(taskId: string) {
  navigateTo(`/app/${props.resource}/${taskId}`)
}

/* ---------------- "Create" — defer to the form page ---------------- */

function onCreateTask(stateId: string) {
  // Navigate to the create form; we pass the column value as a query
  // param so the form can prefill it (forward-compat — SpecDataForm
  // ignores unknown query params today).
  if (!columnField.value) {
    navigateTo(`/app/${props.resource}/new`)
    return
  }
  navigateTo({
    path: `/app/${props.resource}/new`,
    query: { [columnField.value]: stateId },
  })
}

/* ---------------- Header (title + new) ---------------- */

const headerTitle = computed(() => spec.value?.ui?.plural ?? props.resource)
const canCreate = computed(() => {
  const perms = spec.value?.permissions
  if (!perms || !perms.create) return true
  return perms.create.length > 0 || true
})

/* ---------------- Validation guard ---------------- */

/**
 * When `ui.view === 'kanban'` but no `kanbanColumn` is declared, render
 * a visible error block instead of a broken board. Same spirit as the
 * dashboard custom-component error (visible error, not a crash).
 */
const misconfigured = computed(() => {
  if (!spec.value) return false
  const view = spec.value.ui?.view
  if (view !== 'kanban') return false
  return !columnField.value
})

// silence unused warning for the destructured refetch alias placeholder
void _refetchAlias
</script>

<template>
  <div class="w-full">
    <!-- Header -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <h2 class="text-xl font-semibold flex-1 text-base-content">
        {{ headerTitle }}
      </h2>
      <NuxtLink
        v-if="canCreate"
        :to="`/app/${resource}/new`"
        class="btn btn-primary btn-sm"
      >
        + New
      </NuxtLink>
    </div>

    <!-- Misconfiguration error (visible, not a crash) -->
    <div v-if="misconfigured" class="alert alert-error mb-4">
      <span>
        Resource "{{ resource }}" declares <code>ui.view: kanban</code> but
        no <code>ui.kanbanColumn</code> field is set. Add a
        <code>kanbanColumn</code> pointing to the field that defines the
        board columns.
      </span>
    </div>

    <!-- Error banner -->
    <div v-else-if="error" class="alert alert-error mb-4">
      <span>{{ error.message || 'Failed to load data' }}</span>
    </div>

    <!-- Loading skeleton -->
    <div v-else-if="loading && !rows.length" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!loading && !rows.length"
      class="text-center py-12 text-base-content/50"
    >
      No records found.
    </div>

    <!-- Board -->
    <div v-else class="border rounded-md bg-base-100 overflow-hidden">
      <Kanban
        :tasks="tasks"
        :states="columns"
        :group="`spec-kanban-${resource}`"
        :show-toolbar="true"
        @update:task-state="onUpdateTaskState"
        @click-task="onClickTask"
        @create-task="onCreateTask"
      />
    </div>

    <!-- Drag in-flight overlay (subtle) -->
    <div
      v-if="dragInFlight"
      class="text-xs text-base-content/50 mt-2"
      aria-live="polite"
    >
      Saving move…
    </div>
  </div>
</template>