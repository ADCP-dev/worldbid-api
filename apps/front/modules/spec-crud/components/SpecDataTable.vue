<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import type { VNode } from 'vue'
import type { FieldSpec } from '../composables/useSpecResource'
import DataTable from '@base/ui-app/components/data-table/DataTable.vue'
import EditButton from '@base/ui-app/components/data-table/buttons/EditButton.vue'
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue'
import type { MyColumnDef } from '@base/ui-app/components/data-table/types'

const props = defineProps<{
  /** Resource name */
  resource: string
}>()

const specCrud = useSpecResource()
const { useListQuery, useRemoveMutation } = specCrud

const search = ref('')
const sort = ref<string | undefined>(undefined)
const order = ref<'asc' | 'desc' | undefined>(undefined)
const page = ref(1)
const limit = ref(10)

const spec = specCrud.getResource(props.resource)
const primaryKey = computed(() => spec.value?.primaryKey ?? 'id')

const listParams = computed(() => ({
  page: page.value,
  limit: limit.value,
  search: search.value || undefined,
  sort: sort.value,
  order: order.value,
}))

const { data: listResponse, isLoading: loading, error } = useListQuery(
  () => props.resource,
  listParams,
)

const rows = computed(() => listResponse.value?.data ?? [])
const total = computed(() => listResponse.value?.total ?? listResponse.value?.meta?.total ?? 0)

const listFields = computed<FieldSpec[]>(() => {
  if (!spec.value) return []
  const names = spec.value.ui?.listFields
  if (names && names.length) {
    return names
      .map((n) => spec.value!.fields.find((f) => f.name === n))
      .filter((f): f is FieldSpec => !!f)
  }
  return spec.value.fields.filter((f) => f.ui?.listable !== false)
})

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

const columns = computed<MyColumnDef<Record<string, unknown>, unknown>[]>(() => {
  const base: MyColumnDef<Record<string, unknown>, unknown>[] = listFields.value.map((field) => ({
    id: field.name,
    accessorKey: field.name,
    headerName: field.label ?? capitalize(field.name),
    filterType: filterTypeFor(field),
    options: field.enum ? field.enum.map((v) => ({ value: v, label: String(v) })) : undefined,
    enableSorting: !!field.sortable,
    cell: (info) => {
      const row = info.row.original as Record<string, unknown>
      const value = row[field.name]
      return h(SpecFieldRenderer, { value, field, row })
    },
  }))

  if (canUpdate.value || canDelete.value) {
    base.push({
      id: 'actions',
      accessorKey: 'actions',
      headerName: 'Actions',
      filterType: undefined,
      enableSorting: false,
      meta: { align: 'right' },
      cell: (info) => {
        const row = info.row.original as Record<string, unknown>
        const rowId = String(row[primaryKey.value] ?? '')
        const buttons: VNode[] = []
        if (canUpdate.value) {
          buttons.push(h(EditButton, { onClick: () => navigateTo(`/app/${props.resource}/${rowId}`) }))
        }
        if (canDelete.value) {
          buttons.push(h(DeleteButton, { onClick: () => handleDelete(row) }))
        }
        return h('div', { class: 'flex items-center justify-end gap-1' }, buttons)
      },
    })
  }

  return base
})

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function filterTypeFor(field: FieldSpec): MyColumnDef<unknown, unknown>['filterType'] {
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
      return 'string'
  }
}



const removeMutation = useRemoveMutation(() => props.resource)

async function handleDelete(row: Record<string, unknown>) {
  const id = String(row[primaryKey.value] ?? '')
  if (!confirm(`Delete record #${id}?`)) return
  try {
    await removeMutation.mutateAsync(id)
  } catch {
    // mutation errors surface via toast / query error handling
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
  }, 300)
})
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

    <!-- Loading skeleton -->
    <div v-if="loading && !rows.length" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!loading && !rows.length"
      class="text-center py-12 text-base-content/50"
    >
      No records found.
    </div>

    <!-- DataTable -->
    <DataTable
      v-else
      :columns="columns"
      :data="rows"
      :manual="true"
      :total="total"
      table-name="spec-crud-table"
    />
  </div>
</template>
