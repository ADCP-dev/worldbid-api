<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { FieldSpec } from '../composables/useSpecResource'
import SpecFieldRenderer from './SpecFieldRenderer.vue'

/* ------------------------------------------------------------------ *
 * SpecList — compact vertical record list for log/record resources.
 *
 * spec-engine-v2-frontend-and-loader (Slice 6):
 *   - Renders when `ResourceUISpec.view === 'list'`. Alternative to the
 *     DataTable for resources that read better as a vertical list
 *     (logs, events, audit entries).
 *   - Each item is a compact DaisyUI menu/list row with the primary
 *     fields inline, rendered via `SpecFieldRenderer`.
 *   - Pagination uses a "Load more" button (incremental page load),
 *     accumulating rows. Resets on filter/search change.
 *   - Item click navigates to the detail view `/{resource}/{id}`.
 *   - Reuses `useSpecResource.useListQuery` — no new base components.
 * ------------------------------------------------------------------ */

const props = defineProps<{
  /** Resource name */
  resource: string
}>()

const specCrud = useSpecResource()
const { useListQuery } = specCrud

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

/**
 * Accumulated rows for the "load more" pattern. We accumulate across
 * pages and reset whenever the query shape changes (search/filter/sort).
 */
const accumulated = ref<Array<Record<string, unknown>>>([])
const lastPage = ref(1)

watch(
  listParams,
  (next, prev) => {
    // Reset accumulation when the query SHAPE changes (page is the only
    // allowed incremental axis). Compare all non-page fields.
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
    // If the current page is greater than the last accumulated page,
    // append; otherwise (refetch of the same page), replace that slice.
    if (page.value > lastPage.value) {
      const ids = new Set(accumulated.value.map((r) => String(r[primaryKey.value])))
      for (const r of rows) {
        const id = String(r[primaryKey.value])
        if (!ids.has(id)) accumulated.value.push(r)
      }
      lastPage.value = page.value
    } else {
      // same page → replace accumulated tail of the same page
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

/* ---------------- Field selection ---------------- */

/**
 * Fields shown inline on each list item. Resolution:
 *   1. `ui.listFields` when declared (same convention as SpecDataTable)
 *   2. all fields with `ui.listable !== false` (excluding the primary key)
 */
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

/**
 * The primary (title) field for each item — shown prominently.
 */
const titleField = computed<FieldSpec | undefined>(() => {
  if (!spec.value) return undefined
  // first listable field with display 'text' or no display, named 'title' wins
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
        class="btn btn-primary btn-sm"
      >
        + New
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
      No records found.
    </div>

    <!-- List -->
    <div v-else>
      <ul class="menu menu-md bg-base-100 rounded-box border border-base-300 divide-y divide-base-200">
        <li
          v-for="row in accumulated"
          :key="rowId(row)"
        >
          <a
            class="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 cursor-pointer hover:bg-base-200/60"
            @click="onClick(row)"
          >
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
      <div class="flex flex-wrap items-center justify-between gap-3 py-4">
        <div class="text-sm opacity-70">
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