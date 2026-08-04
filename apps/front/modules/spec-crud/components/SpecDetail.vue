<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { type FieldSpec, refResource } from '../composables/useSpecResource'
import { useRefResolver } from '../composables/useRefResolver'
import SpecFieldRenderer from './SpecFieldRenderer.vue'

/* ------------------------------------------------------------------ *
 * SpecDetail — read-only detail view for a single resource record.
 *
 * spec-engine-v2-frontend-and-loader (Slice 6):
 *   - Renders all fields with `SpecFieldRenderer.vue` (display modes:
 *     text/badge/date/avatar/truncate/icon/link).
 *   - Layout: when `ResourceUISpec.sections` is declared, fields are
 *     grouped by `field.ui.section`; otherwise a vertical list.
 *   - Header: title (uses `labelField` or the first string field) +
 *     actions (Edit, Delete, Back).
 *   - Edit → navigates to `/{resource}/{id}/edit` (SpecDataForm edit mode).
 *   - Delete → confirm dialog + `useRemoveMutation`, then navigate
 *     back to `/{resource}`.
 *   - Back → router back when history exists, else navigate to
 *     `/{resource}` (the list view).
 *   - Password/secret fields are masked with bullets and an explicit
 *     show toggle (per field).
 *   - Fields hidden by `showIf` evaluated against the PERSISTED record
 *     values are skipped (same `evalShowIf` semantics as SpecDataForm,
 *     but read-only so no form state — we evaluate against the record).
 *   - Reuses `useSpecResource.useFindOneQuery` + `useRemoveMutation`.
 * ------------------------------------------------------------------ */

const props = defineProps<{
  /** Resource name */
  resource: string
  /** Record id */
  id: string | number
}>()

const specCrud = useSpecResource()
const router = useRouter()

const spec = specCrud.getResource(props.resource)
const primaryKey = computed(() => spec.value?.primaryKey ?? 'id')

/* ---------------- Ref resolver (avatars for ref fields) ---------------- */
const { preloadRefs } = useRefResolver()
watch(
  () => spec.value,
  (s) => {
    if (!s) return
    preloadRefs(s.fields.filter((f) => !!refResource(f)))
  },
  { immediate: true },
)

/* ---------------- Record ---------------- */

const { data: record, isLoading: loading, error, refetch } = specCrud.useFindOneQuery(
  () => props.resource,
  () => props.id,
)

const row = computed<Record<string, unknown>>(() => {
  const data = record.value
  if (!data) return {}
  // useFindOneQuery returns the record (findOne unwraps `.data` already).
  // When the backend wraps again (defensive), unwrap once more.
  if (typeof data === 'object' && 'data' in (data as Record<string, unknown>) && primaryKey.value in ((data as Record<string, unknown>).data as Record<string, unknown>)) {
    return ((data as Record<string, unknown>).data as Record<string, unknown>) ?? {}
  }
  return data as Record<string, unknown>
})

/* ---------------- showIf evaluation (against persisted record) ---------------- */

function evalShowIf(
  showIf: boolean | Record<string, unknown> | undefined,
  values: Record<string, unknown>,
): boolean {
  if (showIf === undefined) return true
  if (typeof showIf === 'boolean') return showIf
  for (const [key, expected] of Object.entries(showIf)) {
    if (values[key] !== expected) return false
  }
  return true
}

/* ---------------- Field selection ---------------- */

/**
 * Fields to render in the detail view. Defaults to all fields, minus
 * the primary key (shown in the header). `ui.listFields`/`formFields`
 * are NOT used here — the detail view shows everything available.
 * `showIf`-hidden fields are skipped.
 */
const detailFields = computed<FieldSpec[]>(() => {
  if (!spec.value) return []
  const all = spec.value.fields.filter((f) => f.name !== primaryKey.value)
  return all.filter((f) => evalShowIf(f.ui?.showIf, row.value))
})

/* ---------------- Sections ---------------- */

/**
 * When `ui.sections` is declared, group `detailFields` by
 * `field.ui.section`. Fields without a section land in a default
 * trailing group (matching SpecDataForm semantics).
 */
type FieldGroup = { id: string; title: string; icon?: string; fields: FieldSpec[] }

const fieldGroups = computed<FieldGroup[]>(() => {
  if (!spec.value) return []
  const sections = spec.value.ui?.sections
  if (!sections || !sections.length) {
    // no sections → single unnamed group
    return [{ id: '__default', title: '', fields: detailFields.value }]
  }
  const groups: FieldGroup[] = sections.map((s) => ({
    id: s.id ?? s.title,
    title: s.title,
    icon: s.icon,
    fields: [],
  }))
  const byId = new Map(groups.map((g) => [g.id, g]))
  const defaultGroup: FieldGroup = {
    id: '__default',
    title: '',
    fields: [],
  }
  for (const f of detailFields.value) {
    const sectionName = f.ui?.section
    if (sectionName) {
      const g = byId.get(sectionName)
      if (g) {
        g.fields.push(f)
      } else {
        // section name not declared in ui.sections → add to default
        defaultGroup.fields.push(f)
      }
    } else {
      defaultGroup.fields.push(f)
    }
  }
  const out = groups.filter((g) => g.fields.length > 0)
  if (defaultGroup.fields.length > 0) out.push(defaultGroup)
  return out
})

/* ---------------- Title (labelField or first string) ---------------- */

const titleField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  // 1. ui.labelField on the column field hint (legacy) — look for any
  //    field declaring labelField pointing to another field
  for (const f of spec.value.fields) {
    const lf = f.ui?.labelField
    if (lf) {
      const t = spec.value.fields.find((x) => x.name === lf)
      if (t) return t
    }
  }
  // 2. a field named 'title' or 'name'
  const named = spec.value.fields.find(
    (f) => f.name === 'title' || f.name === 'name',
  )
  if (named) return named
  // 3. first string/text field
  const strField = spec.value.fields.find(
    (f) => f.type === 'string' || f.type === 'text',
  )
  if (strField) return strField
  // 4. primary key
  return spec.value.fields.find((f) => f.name === primaryKey.value)
})

const titleValue = computed<string>(() => {
  if (!titleField.value) return String(row.value[primaryKey.value] ?? props.id)
  const v = row.value[titleField.value.name]
  return v === null || v === undefined ? String(row.value[primaryKey.value] ?? props.id) : String(v)
})

/* ---------------- Password/secret masking ---------------- */

/**
 * Per-field reveal state. A password/secret field shows bullets by
 * default; clicking the toggle reveals the raw value for that field.
 */
const revealed = ref<Record<string, boolean>>({})

function isSecretField(field: FieldSpec): boolean {
  return field.type === 'password' || field.type === 'secret'
}

function toggleReveal(name: string) {
  revealed.value = { ...revealed.value, [name]: !revealed.value[name] }
}

// Reset reveal state when the record changes
watch(() => props.id, () => {
  revealed.value = {}
})

/**
 * Render a secret field: bullets when masked, raw value when revealed.
 * Falls back to SpecFieldRenderer for non-secret fields.
 */
function secretDisplayValue(field: FieldSpec): string {
  const v = row.value[field.name]
  if (v === null || v === undefined || v === '') return ''
  return revealed.value[field.name] ? String(v) : '•'.repeat(Math.min(12, String(v).length))
}

/* ---------------- Permissions ---------------- */

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

/* ---------------- Actions ---------------- */

const removeMutation = specCrud.useRemoveMutation(() => props.resource)
const deleting = ref(false)

async function onDelete() {
  const id = String(row.value[primaryKey.value] ?? props.id)
  if (!window.confirm(`Delete record #${id}?`)) return
  deleting.value = true
  try {
    await removeMutation.mutateAsync(id)
    navigateTo(`/app/${props.resource}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Delete failed'
    window.alert(msg)
  } finally {
    deleting.value = false
  }
}

function onEdit() {
  navigateTo(`/app/${props.resource}/${String(row.value[primaryKey.value] ?? props.id)}/edit`)
}

function onBack() {
  // Prefer router.back when there's history; otherwise go to the list.
  // Nuxt's useRouter() exposes the underlying Vue router.
  if (window.history.length > 1) {
    router.back()
  } else {
    navigateTo(`/app/${props.resource}`)
  }
}

/* ---------------- Helpers ---------------- */

/**
 * Convert a camelCase / snake_case field name into a human-readable label
 * (mirrors SpecFieldInput.humanizeLabel). Used for the detail-view <dt>
 * labels so "assigneeId" renders as "Assignee" instead of "ASSIGNEEID".
 */
function humanizeLabel(name: string): string {
  const SPECIAL: Record<string, string> = {
    apiKey: 'API Key',
    coverImage: 'Cover Image',
  }
  if (SPECIAL[name]) return SPECIAL[name]
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .trim()
  const words = spaced.split(/\s+/)
  if (words.length > 1 && /Id$/i.test(words[words.length - 1])) {
    words[words.length - 1] = words[words.length - 1].replace(/Id$/i, '')
    if (words[words.length - 1] === '') words.pop()
  }
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/** Label for a field: spec-defined label wins, else humanizeLabel(name). */
function labelFor(field: FieldSpec): string {
  return field.label ?? humanizeLabel(field.name)
}

/**
 * True when the field carries a non-empty value. Null, undefined, empty
 * string, empty object ("{}") and empty array all count as empty.
 */
function hasFieldValue(field: FieldSpec, row: Record<string, unknown>): boolean {
  const v = row[field.name]
  if (v === null || v === undefined) return false
  if (typeof v === 'string' && v.trim() === '') return false
  if (typeof v === 'object' && !Array.isArray(v)) {
    return Object.keys(v as Record<string, unknown>).length > 0
  }
  if (Array.isArray(v) && v.length === 0) return false
  return true
}

/**
 * Whether the field should render in the detail view. Empty fields are
 * skipped, EXCEPT required fields (which always render so the user can
 * see what's missing — they show a muted "—" placeholder).
 */
function shouldShowField(field: FieldSpec, row: Record<string, unknown>): boolean {
  if (field.required) return true
  return hasFieldValue(field, row)
}

/** True when the field's value is considered "empty" for display. */
function isEmptyField(field: FieldSpec, row: Record<string, unknown>): boolean {
  return !hasFieldValue(field, row)
}

/**
 * For decimal/number fields whose name suggests a unit (hours, minutes,
 * seconds), format the raw number with the unit suffix ("4.00" → "4h").
 * Returns null when no unit hint applies (caller falls back to the
 * SpecFieldRenderer). This is a display hint only — it doesn't change the
 * stored value.
 */
function maybeUnitValue(field: FieldSpec, row: Record<string, unknown>): string | null {
  if (field.type !== 'decimal' && field.type !== 'float' && field.type !== 'number' && field.type !== 'integer') return null
  const v = row[field.name]
  if (v === null || v === undefined || v === '') return null
  const num = Number(v)
  if (Number.isNaN(num)) return null
  const n = field.name.toLowerCase()
  if (n.includes('hour')) return `${Number(num.toFixed(2))}h`
  if (n.includes('minute')) return `${num}m`
  if (n.includes('second')) return `${num}s`
  return null
}

// silence unused refetch (kept for forward-compat manual refresh)
void refetch
</script>

<template>
  <div class="container mx-auto px-4 py-6 max-w-4xl">
    <!-- Header -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <button
        class="btn btn-ghost btn-sm"
        @click="onBack"
      >
        ← Back
      </button>
      <h2 class="text-2xl font-semibold flex-1 text-base-content truncate">
        {{ titleValue }}
      </h2>
      <div class="flex items-center gap-2">
        <button
          v-if="canUpdate"
          class="btn btn-outline btn-sm"
          @click="onEdit"
        >
          Edit
        </button>
        <button
          v-if="canDelete"
          class="btn btn-error btn-outline btn-sm"
          :disabled="deleting"
          @click="onDelete"
        >
          <span v-if="deleting" class="loading loading-spinner loading-xs" />
          Delete
        </button>
      </div>
    </div>

    <!-- Error banner -->
    <div v-if="error" class="alert alert-error mb-4">
      <span>{{ error.message || 'Failed to load record' }}</span>
    </div>

    <!-- Loading skeleton -->
    <div v-else-if="loading && !Object.keys(row).length" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <!-- Empty state (record not found / deleted) -->
    <div
      v-else-if="!loading && !Object.keys(row).length"
      class="text-center py-12 text-base-content/50"
    >
      <div class="flex flex-col items-center gap-2">
        <svg class="w-12 h-12 text-base-content/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35M8 11h6" />
        </svg>
        <p>Record not found.</p>
      </div>
    </div>

    <!-- Body -->
    <div v-else class="space-y-6">
      <!-- Primary key + display name meta line -->
      <div class="text-sm text-base-content/50 flex items-center gap-2">
        <span class="badge badge-ghost badge-sm">{{ spec?.ui?.singular ?? resource }}</span>
        <span class="font-mono">#{{ row[primaryKey] ?? id }}</span>
      </div>

      <!-- Sectioned or flat -->
      <section
        v-for="group in fieldGroups"
        :key="group.id"
        class="card bg-base-100 border border-base-200 rounded-lg shadow-sm"
      >
        <div class="card-body p-5 gap-4">
          <h3
            v-if="group.title"
            class="card-title text-sm font-medium text-base-content flex items-center gap-2"
          >
            <span v-if="group.icon" aria-hidden="true">{{ group.icon }}</span>
            {{ group.title }}
          </h3>

          <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div
              v-for="field in group.fields"
              :key="field.name"
              v-show="shouldShowField(field, row)"
              class="flex flex-col gap-1"
            >
              <dt class="text-xs font-medium text-base-content/50 tracking-wide">
                {{ labelFor(field) }}
              </dt>
              <dd class="text-sm text-base-content">
              <!-- Empty value (required field with no data) → muted placeholder -->
              <span
                v-if="isEmptyField(field, row)"
                class="text-base-content/30"
              >—</span>

              <!-- Secret field: masked with toggle -->
              <template v-else-if="isSecretField(field)">
                <span class="inline-flex items-center gap-2 font-mono">
                  <span>{{ secretDisplayValue(field) }}</span>
                  <button
                    class="btn btn-ghost btn-xs"
                    :aria-label="revealed[field.name] ? `Hide ${field.name}` : `Show ${field.name}`"
                    @click="toggleReveal(field.name)"
                  >
                    {{ revealed[field.name] ? 'Hide' : 'Show' }}
                  </button>
                </span>
              </template>

              <!-- Decimal/integer field with a unit hint (hours/minutes/seconds) -->
              <template v-else-if="maybeUnitValue(field, row) !== null">
                <span>{{ maybeUnitValue(field, row) }}</span>
              </template>

              <!-- Regular field: SpecFieldRenderer -->
              <SpecFieldRenderer
                v-else
                :value="row[field.name]"
                :field="field"
                :row="row"
              />
            </dd>
          </div>
        </dl>
        </div>
      </section>
    </div>
  </div>
</template>