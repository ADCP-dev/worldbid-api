<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { type FieldSpec, refResource, refLabelField } from '../composables/useSpecResource'
import { useRefResolver } from '../composables/useRefResolver'
import SpecFieldRenderer from './SpecFieldRenderer.vue'

/* ------------------------------------------------------------------ *
 * SpecList — compact vertical record list for log/record resources.
 *
 * Visual fixes:
 *   - When the resource has a field named `action` or `type` with an enum
 *     (audit-log style), each item renders as a TIMELINE entry: colored
 *     icon by action type, description, badge, relative timestamp, and
 *     the triggering user as an avatar.
 *   - Ref fields (userId, taskId) are resolved via useRefResolver so the
 *     UI shows "Super Admin" / "Design database schema" instead of raw
 *     FK ids.
 *   - Removed the generic `menu` class; items use a custom timeline layout
 *     with hover:bg-base-200, rounded corners, and a left border colored
 *     by action type.
 * ------------------------------------------------------------------ */

const props = defineProps<{
  /** Resource name */
  resource: string
}>()

const specCrud = useSpecResource()
const { useListQuery } = specCrud
const { preloadRefs, resolveRefDisplay } = useRefResolver()

const spec = specCrud.getResource(props.resource)
const primaryKey = computed(() => spec.value?.primaryKey ?? 'id')

/* ---------------- Reactive query state ---------------- */

const search = ref('')
const sort = ref<string | undefined>(undefined)
const order = ref<'asc' | 'desc' | undefined>(undefined)
const filters = ref<Record<string, unknown>>({})

const PAGE_SIZE = 25
const page = ref(1)
const limit = ref(PAGE_SIZE)

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

const currentRows = computed(() => listResponse.value?.data ?? [])
const total = computed(
  () => listResponse.value?.total ?? listResponse.value?.meta?.total ?? 0,
)

const accumulated = ref<Array<Record<string, unknown>>>([])
const lastPage = ref(1)

watch(
  listParams,
  (next, prev) => {
    const sameShape =
      next.search === prev?.search &&
      next.sort === prev?.sort &&
      next.order === prev?.order &&
      JSON.stringify(next.filter) === JSON.stringify(prev?.filter)
    if (!sameShape) {
      accumulated.value = []
      lastPage.value = 1
    }
  },
  { deep: true },
)

watch(
  currentRows,
  (rows) => {
    if (!rows.length) return
    if (page.value > lastPage.value) {
      const ids = new Set(accumulated.value.map((r) => String(r[primaryKey.value])))
      for (const r of rows) {
        const id = String(r[primaryKey.value])
        if (!ids.has(id)) accumulated.value.push(r)
      }
      lastPage.value = page.value
    } else {
      const start = (page.value - 1) * PAGE_SIZE
      accumulated.value = [
        ...accumulated.value.slice(0, start),
        ...rows,
      ]
      lastPage.value = page.value
    }
  },
  { immediate: true },
)

const hasMore = computed(() => accumulated.value.length < total.value)
const loadingMore = ref(false)

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  page.value = page.value + 1
  try {
    await refetch()
  } finally {
    loadingMore.value = false
  }
}

/* Preload ref resources so avatars/labels resolve. */
watch(
  () => spec.value,
  (s) => {
    if (!s) return
    preloadRefs(s.fields.filter((f) => !!refResource(f)))
  },
  { immediate: true },
)

/* ---------------- Field selection ---------------- */

const listFields = computed<FieldSpec[]>(() => {
  if (!spec.value) return []
  const names = spec.value.ui?.listFields
  if (names && names.length) {
    return names
      .map((n) => spec.value!.fields.find((f) => f.name === n))
      .filter((f): f is FieldSpec => !!f)
  }
  return spec.value.fields.filter(
    (f) => f.name !== primaryKey.value && f.ui?.display !== undefined,
  )
})

const titleField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  const t = listFields.value.find(
    (f) => f.name === 'title' || f.name === 'name',
  )
  if (t) return t
  return listFields.value[0]
})

const inlineFields = computed<FieldSpec[]>(() => {
  if (!titleField.value) return listFields.value
  return listFields.value.filter((f) => f.name !== titleField.value.name)
})

/** Inline fields for the TIMELINE view, excluding the fields rendered
 *  explicitly (action, description, user, timestamp). */
const timelineInlineFields = computed<FieldSpec[]>(() => {
  const exclude = new Set<string>()
  if (descriptionField.value) exclude.add(descriptionField.value.name)
  if (actionField.value) exclude.add(actionField.value.name)
  if (userRefField.value) exclude.add(userRefField.value.name)
  if (timestampField.value) exclude.add(timestampField.value.name)
  return listFields.value.filter((f) => !exclude.has(f.name))
})

/* ---------------- Timeline detection ---------------- */

/**
 * When the resource has an `action` or `type` enum field, we render the
 * list as a timeline of audit-log entries instead of the generic list.
 */
const actionField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  return spec.value.fields.find(
    (f) => (f.name === 'action' || f.name === 'type') && !!f.enum?.length,
  )
})

const descriptionField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  return spec.value.fields.find((f) => f.type === 'text' && f.name === 'description')
})

const userRefField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  return spec.value.fields.find((f) => refResource(f) === 'user')
})

const timestampField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  return spec.value.fields.find((f) => f.name === 'createdAt' || f.type === 'datetime')
})

const isTimeline = computed(() => !!actionField.value)

/** Action type → { icon, badge class, border class }. */
const ACTION_STYLES: Record<string, { icon: string; badge: string; border: string }> = {
  created: { icon: 'plus', badge: 'badge-success', border: 'border-l-success' },
  updated: { icon: 'pencil', badge: 'badge-info', border: 'border-l-info' },
  deleted: { icon: 'trash', badge: 'badge-error', border: 'border-l-error' },
  commented: { icon: 'chat', badge: 'badge-primary', border: 'border-l-primary' },
  assigned: { icon: 'user-plus', badge: 'badge-info', border: 'border-l-info' },
  closed: { icon: 'check', badge: 'badge-success', border: 'border-l-success' },
  reopened: { icon: 'rotate', badge: 'badge-warning', border: 'border-l-warning' },
}
const DEFAULT_ACTION_STYLE = { icon: 'activity', badge: 'badge-ghost', border: 'border-l-base-300' }

function actionStyle(value: unknown) {
  const key = String(value ?? '')
  return ACTION_STYLES[key] ?? DEFAULT_ACTION_STYLE
}

/* Inline SVG path for each action icon (Lucide-style stroke). */
const ICON_PATHS: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  pencil: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  'user-plus': 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 7a4 4 0 1 0 0 .01M19 8v6M22 11h-6',
  check: 'M20 6L9 17l-5-5',
  rotate: 'M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
}

function iconPath(icon: string): string {
  return ICON_PATHS[icon] ?? ICON_PATHS.activity
}

/** Background class for the action icon circle, keyed by action type. */
const ACTION_BG: Record<string, string> = {
  created: 'bg-success/15 text-success',
  updated: 'bg-info/15 text-info',
  deleted: 'bg-error/15 text-error',
  commented: 'bg-primary/15 text-primary',
  assigned: 'bg-info/15 text-info',
  closed: 'bg-success/15 text-success',
  reopened: 'bg-warning/15 text-warning',
}
const DEFAULT_ACTION_BG = 'bg-base-300/50 text-base-content/70'

function actionBgClass(value: unknown): string {
  const key = String(value ?? '')
  return ACTION_BG[key] ?? DEFAULT_ACTION_BG
}

/* ---------------- Relative time ---------------- */

function relativeTime(value: unknown): string {
  if (!value) return ''
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  const diff = d.getTime() - Date.now()
  const absSec = Math.abs(diff) / 1000
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (absSec < 60) return rtf.format(Math.round(diff / 1000), 'second')
  if (absSec < 3600) return rtf.format(Math.round(diff / 60000), 'minute')
  if (absSec < 86400) return rtf.format(Math.round(diff / 3600000), 'hour')
  if (absSec < 2592000) return rtf.format(Math.round(diff / 86400000), 'day')
  if (absSec < 31536000) return rtf.format(Math.round(diff / 2592000000), 'month')
  return rtf.format(Math.round(diff / 31536000000), 'year')
}

function fullDate(value: unknown): string {
  if (!value) return ''
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/* ---------------- Ref display helpers ---------------- */

function userDisplay(row: Record<string, unknown>) {
  const f = userRefField.value
  const res = f ? refResource(f) : undefined
  if (!f || !res) return undefined
  const id = row[f.name]
  if (id === null || id === undefined || id === '') return undefined
  return resolveRefDisplay(res, id as string | number, refLabelField(f))
}

/* ---------------- Item click → detail ---------------- */

function rowId(row: Record<string, unknown>): string {
  return String(row[primaryKey.value] ?? '')
}

function onClick(row: Record<string, unknown>) {
  navigateTo(`/app/${props.resource}/${rowId(row)}`)
}

/* ---------------- Permissions ---------------- */

const canCreate = computed(() => {
  const perms = spec.value?.permissions
  if (!perms || !perms.create) return true
  return perms.create.length > 0 || true
})

/* ---------------- Search debounce ---------------- */

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    limit.value = PAGE_SIZE
  }, 300)
})

/* ---------------- Helpers ---------------- */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
</script>

<template>
  <div class="w-full">
    <!-- Header -->
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

    <!-- Error banner -->
    <div v-if="error" class="alert alert-error mb-4">
      <span>{{ error.message || 'Failed to load data' }}</span>
    </div>

    <!-- Loading skeleton (first load) -->
    <div v-if="loading && !accumulated.length" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!loading && !accumulated.length"
      class="text-center py-12 text-base-content/50"
    >
      <div class="flex flex-col items-center gap-2">
        <svg class="w-12 h-12 text-base-content/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <p>No records found.</p>
      </div>
    </div>

    <!-- ═══ TIMELINE view (audit-log style) ═══ -->
    <div v-else-if="isTimeline" class="card bg-base-100 border border-base-200 rounded-lg shadow-sm">
      <ul class="divide-y divide-base-200">
        <li
          v-for="row in accumulated"
          :key="rowId(row)"
          class="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-base-200/50 transition-colors border-l-4"
          :class="actionStyle(row[actionField!.name]).border"
          @click="onClick(row)"
        >
          <!-- Left: action icon -->
          <span
            class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ring-1 ring-base-300"
            :class="actionBgClass(actionField ? row[actionField.name] : null)"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path :d="iconPath(actionStyle(actionField ? row[actionField.name] : null).icon)" />
            </svg>
          </span>

          <!-- Middle: description + action badge -->
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-0.5">
              <span
                class="badge badge-sm"
                :class="actionStyle(actionField ? row[actionField.name] : null).badge"
              >
                {{ actionField ? row[actionField.name] : '' }}
              </span>
            </div>
            <p
              v-if="descriptionField"
              class="text-sm text-base-content leading-snug"
            >
              {{ row[descriptionField.name] }}
            </p>
            <!-- Inline non-primary fields (excluding action/description/createdAt/user which are rendered explicitly) -->
            <div
              v-if="timelineInlineFields.length"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-base-content/60"
            >
              <span
                v-for="field in timelineInlineFields"
                :key="field.name"
                class="inline-flex items-center gap-1"
              >
                <span class="opacity-50">{{ field.label ?? capitalize(field.name) }}:</span>
                <SpecFieldRenderer :value="row[field.name]" :field="field" :row="row" />
              </span>
            </div>
          </div>

          <!-- Right: user avatar + timestamp -->
          <div class="flex flex-col items-end gap-1 flex-shrink-0">
            <span
              v-if="userDisplay(row)"
              class="inline-flex items-center gap-1.5"
            >
              <span class="avatar avatar-placeholder">
                <span class="w-6 rounded-full bg-neutral text-neutral-content ring-1 ring-base-300">
                  <img
                    v-if="userDisplay(row)?.avatarUrl"
                    :src="userDisplay(row)!.avatarUrl"
                    :alt="userDisplay(row)!.label"
                    class="rounded-full"
                  >
                  <span v-else class="text-[10px] font-semibold">{{ userDisplay(row)?.initials ?? '?' }}</span>
                </span>
              </span>
              <span class="text-xs text-base-content/70">{{ userDisplay(row)?.label }}</span>
            </span>
            <time
              v-if="timestampField"
              :datetime="String(row[timestampField.name])"
              :title="fullDate(row[timestampField.name])"
              class="text-xs text-base-content/50"
            >{{ relativeTime(row[timestampField.name]) }}</time>
          </div>
        </li>
      </ul>

      <!-- Footer: count + load more -->
      <div class="flex flex-wrap items-center justify-between gap-3 p-3 border-t border-base-200">
        <div class="text-sm text-base-content/60">
          Showing {{ accumulated.length }} of {{ total }}
        </div>
        <button
          v-if="hasMore"
          class="btn btn-outline btn-sm"
          :disabled="loadingMore"
          @click="loadMore"
        >
          <span v-if="loadingMore" class="loading loading-spinner loading-xs" />
          Load more
        </button>
      </div>
    </div>

    <!-- ═══ GENERIC list view (non-timeline resources) ═══ -->
    <div v-else class="card bg-base-100 border border-base-200 rounded-lg shadow-sm overflow-hidden">
      <ul class="divide-y divide-base-200">
        <li
          v-for="row in accumulated"
          :key="rowId(row)"
          class="px-4 py-3 cursor-pointer hover:bg-base-200/50 transition-colors"
          @click="onClick(row)"
        >
          <a class="flex flex-wrap items-center gap-x-4 gap-y-1">
            <!-- Title field -->
            <span
              v-if="titleField"
              class="font-semibold text-base-content min-w-[10rem] flex-1 truncate"
            >
              <SpecFieldRenderer
                :value="row[titleField.name]"
                :field="titleField"
                :row="row"
              />
            </span>

            <!-- Inline fields -->
            <span
              v-for="field in inlineFields"
              :key="field.name"
              class="text-sm text-base-content/70 inline-flex items-center gap-1"
            >
              <span class="opacity-50">{{ field.label ?? capitalize(field.name) }}:</span>
              <SpecFieldRenderer
                :value="row[field.name]"
                :field="field"
                :row="row"
              />
            </span>
          </a>
        </li>
      </ul>

      <!-- Footer: count + load more -->
      <div class="flex flex-wrap items-center justify-between gap-3 p-3 border-t border-base-200">
        <div class="text-sm text-base-content/60">
          Showing {{ accumulated.length }} of {{ total }}
        </div>
        <button
          v-if="hasMore"
          class="btn btn-outline btn-sm"
          :disabled="loadingMore"
          @click="loadMore"
        >
          <span v-if="loadingMore" class="loading loading-spinner loading-xs" />
          Load more
        </button>
      </div>
    </div>
  </div>
</template>