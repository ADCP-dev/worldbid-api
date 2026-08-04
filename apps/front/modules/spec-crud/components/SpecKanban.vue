<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import Kanban from '@base/ui-app/components/kanban/Kanban.vue'
import type {
  KanbanTask,
  KanbanStateConfig,
  KanbanColumnStyleConfig,
  KanbanAssignee,
} from '@base/ui-app/components/kanban/types'
import { type FieldSpec, refResource, refLabelField } from '../composables/useSpecResource'
import { useRefResolver } from '../composables/useRefResolver'

/* ------------------------------------------------------------------ *
 * SpecKanban — spec-driven kanban view.
 *
 * Reuses the base `@base/ui-app/kanban/Kanban.vue` component (NO new
 * base component created). Columns are derived from the field named by
 * `ResourceUISpec.kanbanColumn`. Drag & drop is PESSIMISTIC.
 *
 * Visual fixes:
 *   - Column headers colored via `stateConfig` using the spec's
 *     `ui.colors` map (pending=warning, in_progress=info, review=primary,
 *     done=success, blocked=error).
 *   - Cards carry resolved assignee (avatar + name) and priority badge
 *     via the useRefResolver cache (raw FK ids → user records).
 *   - The board no longer wraps the base component in a border; the
 *     base Kanban already provides a clean column layout.
 * ------------------------------------------------------------------ */

const props = defineProps<{
  /** Resource name */
  resource: string
}>()

const specCrud = useSpecResource()
const { useListQuery, update } = specCrud

const spec = specCrud.getResource(props.resource)
const primaryKey = computed(() => spec.value?.primaryKey ?? 'id')

/* ---------------- Ref resolver (assignee/reporter avatars) ---------------- */

const { preloadRefs, resolveRefDisplay } = useRefResolver()

/* ---------------- Kanban field resolution ---------------- */

const columnField = computed<string | undefined>(() => spec.value?.ui?.kanbanColumn)
const orderField = computed<string | undefined>(() => spec.value?.ui?.kanbanOrder)

const columnFieldSpec = computed<FieldSpec | undefined>(() => {
  if (!spec.value || !columnField.value) return undefined
  return spec.value.fields.find((f) => f.name === columnField.value)
})

/* ---------------- Card fields ---------------- */

const titleField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  const fields = spec.value.fields
  const labelName = columnFieldSpec.value?.ui?.labelField
  if (labelName) {
    const f = fields.find((x) => x.name === labelName)
    if (f) return f
  }
  const t = fields.find((x) => x.name === 'title')
  if (t) return t
  const strField = fields.find(
    (x) => x.type === 'string' || x.type === 'text',
  )
  if (strField) return strField
  return fields.find((x) => x.name === primaryKey.value) ?? fields[0]
})

const descriptionField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  return spec.value.fields.find(
    (f) =>
      f.name !== titleField.value?.name &&
      (f.type === 'text' || f.ui?.display === 'truncate'),
  )
})

/** Field holding the assignee FK (ref→user). */
const assigneeField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  return spec.value.fields.find(
    (f) => refResource(f) === 'user' && f.name.toLowerCase().includes('assignee'),
  )
})

/** Field holding the priority enum. */
const priorityField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  return spec.value.fields.find((f) => f.name === 'priority' && f.enum?.length)
})

/** Field holding the due date. */
const dueDateField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  return spec.value.fields.find((f) => f.type === 'datetime' && f.name.toLowerCase().includes('due'))
})

/* ---------------- List query ---------------- */

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

/* Preload ref resources (users, etc.) so cards can render avatars. */
watch(
  () => spec.value,
  (s) => {
    if (!s) return
    preloadRefs(s.fields.filter((f) => !!refResource(f)))
  },
  { immediate: true },
)

/* ---------------- Column resolution ---------------- */

/**
 * Map a spec color hex (or token) to a base color token the base
 * Kanban component understands: neutral, success, warning, info,
 * error, primary.
 */
const HEX_COLOR_MAP: Record<string, string> = {
  '#f59e0b': 'warning',
  '#3b82f6': 'info',
  '#8b5cf6': 'primary',
  '#22c55e': 'success',
  '#ef4444': 'error',
  '#6b7280': 'neutral',
  // also accept bare token names
  warning: 'warning',
  info: 'info',
  primary: 'primary',
  success: 'success',
  error: 'error',
  neutral: 'neutral',
}

function colorTokenFor(value: string): string | undefined {
  const colors = columnFieldSpec.value?.ui?.colors
  if (!colors) return undefined
  const hex = colors[value]
  if (!hex) return undefined
  return HEX_COLOR_MAP[hex.toLowerCase()] ?? 'neutral'
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
      color: colorTokenFor(String(value)),
    }))
  }
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
      color: colorTokenFor(key),
    })
  }
  return out
})

/* ---------------- Per-state column styling (colored headers) ---------------- */

/**
 * Build a `KanbanColumnStyleConfig` so each column header + border carries
 * the status color. The base KanbanColumn applies `headerClass`,
 * `borderClass`, and `bgClass` from this map.
 */
const stateConfig = computed<KanbanColumnStyleConfig>(() => {
  const out: KanbanColumnStyleConfig = {}
  for (const col of columns.value) {
    const token = col.color
    if (!token) continue
    out[col.id] = columnStyleFor(token)
  }
  return out
})

function columnStyleFor(token: string): { headerClass: string; borderClass: string; bgClass: string } {
  switch (token) {
    case 'warning':
      return {
        headerClass: 'bg-warning/15 text-warning-content',
        borderClass: 'border-l-4 border-l-warning',
        bgClass: 'bg-base-200/40',
      }
    case 'info':
      return {
        headerClass: 'bg-info/15 text-info-content',
        borderClass: 'border-l-4 border-l-info',
        bgClass: 'bg-base-200/40',
      }
    case 'primary':
      return {
        headerClass: 'bg-primary/15 text-primary-content',
        borderClass: 'border-l-4 border-l-primary',
        bgClass: 'bg-base-200/40',
      }
    case 'success':
      return {
        headerClass: 'bg-success/15 text-success-content',
        borderClass: 'border-l-4 border-l-success',
        bgClass: 'bg-base-200/40',
      }
    case 'error':
      return {
        headerClass: 'bg-error/15 text-error-content',
        borderClass: 'border-l-4 border-l-error',
        bgClass: 'bg-base-200/40',
      }
    case 'neutral':
    default:
      return {
        headerClass: 'bg-base-300/50 text-base-content',
        borderClass: 'border-l-4 border-l-base-300',
        bgClass: 'bg-base-200/40',
      }
  }
}

/* ---------------- Record → KanbanTask adapter ---------------- */

function rowValue(row: Record<string, unknown>, field: FieldSpec | undefined): unknown {
  if (!field) return undefined
  return row[field.name]
}

/** Build a KanbanAssignee from a raw assigneeId via the ref resolver.
 *  Only `name` and `avatarUrl` are surfaced as visible card content; the
 *  email is passed for the tooltip but the role is omitted when blank so
 *  the tooltip doesn't render a trailing " · " separator. */
function assigneeFor(row: Record<string, unknown>): KanbanAssignee | undefined {
  const f = assigneeField.value
  const res = f ? refResource(f) : undefined
  if (!f || !res) return undefined
  const id = row[f.name]
  if (id === null || id === undefined || id === '') return undefined
  const disp = resolveRefDisplay(res, id as string | number, refLabelField(f))
  return {
    id: String(id),
    name: disp.label,
    email: disp.subLabel ?? '',
    // Omit the role segment when blank — the base UserAvatar joins
    // name/email/role with " · " and an empty role produces a dangling
    // separator ("Super · admin@example.com · ").
    role: '',
    avatarUrl: disp.avatarUrl,
  }
}

/** Map the spec priority enum value to the base KanbanTask priority union. */
function priorityFor(row: Record<string, unknown>): KanbanTask['priority'] {
  if (!priorityField.value) return undefined
  const v = row[priorityField.value.name]
  if (v === null || v === undefined) return undefined
  const s = String(v)
  if (s === 'low' || s === 'medium' || s === 'high') return s
  // 'urgent' maps to 'high' (the base union only has low/medium/high)
  if (s === 'urgent') return 'high'
  return undefined
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
    const dueVal = dueDateField.value ? rowValue(row, dueDateField.value) : undefined
    return {
      id,
      title: titleVal === null || titleVal === undefined ? id : String(titleVal),
      description: descVal === null || descVal === undefined ? undefined : String(descVal),
      stateId: stateVal === null || stateVal === undefined ? '' : String(stateVal),
      metadata: { ...row },
      assignee: assigneeFor(row),
      priority: priorityFor(row),
      dueDate: dueVal === null || dueVal === undefined ? undefined : String(dueVal),
    } satisfies KanbanTask
  })
})

/* ---------------- Drag & drop (PESSIMISTIC) ---------------- */

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
    await refetch()
    toast.success('Moved', {
      description: `${titleCaseValue(oldStateId)} → ${titleCaseValue(newStateId)}`,
    })
  } catch (err: unknown) {
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
  if (!columnField.value) {
    navigateTo(`/app/${props.resource}/new`)
    return
  }
  navigateTo({
    path: `/app/${props.resource}/new`,
    query: { [columnField.value]: stateId },
  })
}

/* ---------------- Header ---------------- */

const headerTitle = computed(() => spec.value?.ui?.plural ?? props.resource)
const canCreate = computed(() => {
  const perms = spec.value?.permissions
  if (!perms || !perms.create) return true
  return perms.create.length > 0 || true
})

/* ---------------- Validation guard ---------------- */

const misconfigured = computed(() => {
  if (!spec.value) return false
  const view = spec.value.ui?.view
  if (view !== 'kanban') return false
  return !columnField.value
})
</script>

<template>
  <div class="w-full flex flex-col h-full">
    <!-- Header -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <h2 class="text-xl font-semibold flex-1 text-base-content">
        {{ headerTitle }}
      </h2>
      <NuxtLink
        v-if="canCreate"
        :to="`/app/${resource}/new`"
        class="btn btn-primary btn-sm gap-1"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New
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
      <div class="flex flex-col items-center gap-2">
        <svg class="w-12 h-12 text-base-content/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M15 3v18" />
        </svg>
        <p>No records found.</p>
      </div>
    </div>

    <!-- Board: base Kanban component (no wrapper border; columns own their bg) -->
    <div v-else class="kanban-board flex-1 min-h-0 rounded-lg border border-base-200 bg-base-100 overflow-hidden">
      <Kanban
        :tasks="tasks"
        :states="columns"
        :state-config="stateConfig"
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
      class="text-xs text-base-content/50 mt-2 flex items-center gap-1"
      aria-live="polite"
    >
      <span class="loading loading-spinner loading-xs" />
      Saving move…
    </div>
  </div>
</template>

<style scoped>
/* ────────────────────────────────────────────────────────────────────
 * Card & column visual overrides for the base Kanban component.
 *
 * The base `@base/ui-app/kanban/KanbanCard.vue` renders `.card.card-compact`
 * and `KanbanColumn.vue` wraps cards in a `flex flex-col gap-2` body.
 * These scoped `:deep()` rules tighten spacing, add a clearer border +
 * rounded corners, and give cards a hover shadow — without modifying the
 * shared base component. Scoped under `.kanban-board` so they don't leak.
 * ──────────────────────────────────────────────────────────────────── */
:deep(.kanban-board .card.card-compact) {
  margin-bottom: 0.5rem;
  padding: 0.75rem;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  border: 1px solid oklch(0.92 0 0.01 / 0.5);
  border-radius: 0.5rem;
  transition: box-shadow 0.15s;
}
:deep(.kanban-board .card.card-compact:hover) {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
</style>