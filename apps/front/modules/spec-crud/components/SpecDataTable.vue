<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { FieldSpec, ResourceSpec } from '../composables/useSpecResource'

const props = defineProps<{
  /** Resource name */
  resource: string
}>()

const emit = defineEmits<{
  edit: [row: Record<string, unknown>]
}>()

const specCrud = useSpecResource()

const loading = ref(false)
const error = ref<string | null>(null)
const rows = ref<Record<string, unknown>[]>([])
const total = ref(0)
const page = ref(1)
const limit = ref(10)
const search = ref('')

const spec = computed<ResourceSpec | undefined>(() => specCrud.getResource(props.resource))

const primaryKey = computed(() => spec.value?.primaryKey ?? 'id')

/** Fields to show in the table. */
const listFields = computed<FieldSpec[]>(() => {
  if (!spec.value) return []
  const names = spec.value.ui?.listFields
  if (names && names.length) {
    return names
      .map((n) => spec.value!.fields.find((f) => f.name === n))
      .filter((f): f is FieldSpec => !!f)
  }
  return spec.value.fields
})

/** Whether user can create. */
const canCreate = computed(() => {
  // Permissions are role arrays; if absent, assume allowed.
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

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

const pageNumbers = computed(() => {
  const pages: number[] = []
  const delta = 2
  let start = Math.max(1, page.value - delta)
  let end = Math.min(totalPages.value, page.value + delta)
  if (end - start < 4) {
    if (start === 1) end = Math.min(totalPages.value, 5)
    if (end === totalPages.value) start = Math.max(1, totalPages.value - 4)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

async function fetchData() {
  if (!spec.value) return
  loading.value = true
  error.value = null
  try {
    const res = await specCrud.list(props.resource, {
      page: page.value,
      limit: limit.value,
      search: search.value || undefined,
    })
    rows.value = res.data ?? []
    total.value = res.total ?? res.meta?.total ?? 0
  } catch (e) {
    error.value = (e as Error).message || 'Failed to load data'
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await specCrud.ensureSpec()
  await fetchData()
})

watch([page, limit], () => fetchData())

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    fetchData()
  }, 300)
})

function fieldLabel(field: FieldSpec): string {
  return field.label ?? field.name
}

function rowId(row: Record<string, unknown>): string {
  return String(row[primaryKey.value] ?? '')
}

function prevPage() {
  if (page.value > 1) page.value--
}
function nextPage() {
  if (page.value < totalPages.value) page.value++
}

function confirmDelete(row: Record<string, unknown>) {
  const id = rowId(row)
  if (!confirm(`Delete record #${id}?`)) return
  specCrud.remove(props.resource, id).then(() => fetchData())
}

defineExpose({ fetchData })
</script>

<template>
  <div class="w-full">
    <!-- Header bar -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <h2 class="text-xl font-semibold flex-1">
        {{ spec?.ui?.plural ?? resource }}
      </h2>

      <input
        v-model="search"
        type="text"
        class="input input-bordered input-sm w-64"
        placeholder="Search…"
      />

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
      <span>{{ error }}</span>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading && !rows.length" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!loading && !rows.length"
      class="text-center py-12 text-base-content/50"
    >
      No records found.
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto border border-base-300 rounded-lg bg-base-100">
      <table class="table table-zebra table-sm">
        <thead>
          <tr>
            <th
              v-for="field in listFields"
              :key="field.name"
              class="font-semibold"
            >
              {{ fieldLabel(field) }}
            </th>
            <th v-if="canUpdate || canDelete" class="text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="rowId(row)"
            class="hover"
          >
            <td v-for="field in listFields" :key="field.name">
              <SpecFieldRenderer
                :value="row[field.name]"
                :field="field"
                :row="row"
              />
            </td>
            <td v-if="canUpdate || canDelete" class="text-right whitespace-nowrap">
              <NuxtLink
                v-if="canUpdate"
                :to="`/app/${resource}/${rowId(row)}`"
                class="btn btn-ghost btn-xs"
              >
                Edit
              </NuxtLink>
              <button
                v-if="canDelete"
                class="btn btn-ghost btn-xs text-error"
                @click="confirmDelete(row)"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div
      v-if="total > 0"
      class="flex flex-wrap items-center justify-between mt-4 gap-3"
    >
      <div class="text-sm opacity-70">
        Showing
        {{ (page - 1) * limit + 1 }}
        –
        {{ Math.min(page * limit, total) }}
        of {{ total }}
      </div>

      <div class="flex items-center gap-1">
        <button
          class="btn btn-outline btn-sm"
          :disabled="page === 1"
          @click="prevPage"
        >
          Prev
        </button>

        <button
          v-for="p in pageNumbers"
          :key="p"
          class="btn btn-sm"
          :class="p === page ? 'btn-primary' : 'btn-outline'"
          @click="page = p"
        >
          {{ p }}
        </button>

        <button
          class="btn btn-outline btn-sm"
          :disabled="page === totalPages"
          @click="nextPage"
        >
          Next
        </button>

        <select
          v-model="limit"
          class="select select-bordered select-sm ml-2"
        >
          <option v-for="s in [10, 20, 50]" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
    </div>
  </div>
</template>