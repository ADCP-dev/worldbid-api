# Frontend Data Table Patterns

> Detail for `frontend` skill. See the SKILL.md for core rules.

## Data Table with TanStack

```vue
<script setup lang="ts">
import DataTable from '@base/ui-app/components/data-table/DataTable.vue'
import { useQuery } from '@tanstack/vue-query'

const { data, isLoading } = useQuery({
  queryKey: ['users'],
  queryFn: () => api.getUsers(),
})

const columns = [
  { accessorKey: 'firstName', headerName: 'First Name', header: 'First Name', filterType: 'string' as const },
  { accessorKey: 'lastName', headerName: 'Last Name', header: 'Last Name', filterType: 'string' as const },
  { accessorKey: 'email', headerName: 'Email', header: 'Email', filterType: 'string' as const },
  { accessorKey: 'role', headerName: 'Role', header: 'Role', filterType: 'select' as const,
    options: [
      { value: 'admin', label: 'Admin' },
      { value: 'user', label: 'User' },
    ],
  },
]
</script>

<template>
  <DataTable
    :data="data?.data ?? []"
    :columns="columns"
    :loading="isLoading"
    :total="data?.meta?.total ?? 0"
  />
</template>
```

## Data Table with Actions

```vue
<script setup lang="ts">
import DataTable from '@base/ui-app/components/data-table/DataTable.vue'
import EditButton from '@base/ui-app/components/data-table/buttons/EditButton.vue'
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue'
import ViewButton from '@base/ui-app/components/data-table/buttons/ViewButton.vue'

const columns = [
  { accessorKey: 'name', headerName: 'Name', header: 'Name', filterType: 'string' as const },
  {
    id: 'actions',
    headerName: 'Actions',
    header: 'Actions',
    enableSorting: false,
    cell: ({ row }) => {
      return h('div', { class: 'flex gap-2' }, [
        h(ViewButton, { to: `/app/items/${row.original.id}` }),
        h(EditButton, { to: `/app/items/${row.original.id}/edit` }),
        h(DeleteButton, { onClick: () => handleDelete(row.original.id) }),
      ])
    },
  },
]
</script>
```

## Filter Types Reference

| filterType | Use case | Component |
|------------|----------|-----------|
| `"string"` | Text search | Default input |
| `"number"` | Numeric range | Number input |
| `"boolean"` | Yes/no | Toggle |
| `"select"` | Dropdown list | Select with options |
| `"date"` | Date range | Date picker |
| `"combobox"` | Searchable async | Combobox with search |

## Composables Pattern (TanStack Query)

```typescript
// composables/useUsers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => $fetch('/api/v1/users'),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUserDto) => $fetch('/api/v1/users', { method: 'POST', body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}
```
