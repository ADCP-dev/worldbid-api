---
name: vue-data-table
description: Create paginated data tables with TanStack Vue Table and backend integration. Use for admin panels, list pages, CRUD interfaces.
---
# Vue Data Table

Crear tablas paginadas con TanStack Vue Table. ⚠️ **NUNCA escribir tables desde cero.**

## Uso Básico
```vue
<script setup lang="ts">
import { computed } from "vue";
import DataTable from "@/modules/base/ui-app/components/data-table/DataTable.vue";
const columns = computed(() => [
  { accessorKey: "id", headerName: "ID", filterType: "number" },
  { accessorKey: "name", headerName: "Name", filterType: "string" },
]);
</script>
<template>
  <DataTable ref="tableRef" :columns="columns" endpoint="users" table-name="admin-users" />
</template>
```

## Column Definition
| Prop | Tipo | Descripción |
|---|---|---|
| `accessorKey` | string | Path al campo |
| `headerName` | string | Texto header |
| `filterType` | "string"\|"number"\|"date"\|"select"\|"combobox"\|"boolean" | Tipo filtro |
| `options` | `{value,label}[]` | Opciones pa select/combobox |
| `cell` | `({row}) => VNode` | Renderer custom con `h()` |
| `enableSorting` | boolean | Default true |

## Cell Renderer / Actions
```typescript
{ accessorKey: "status.id", headerName: "Status", filterType: "select",
  options: [{ value: "1", label: "Active" }],
  cell: ({ row }: any) => h("div", { class: "badge badge-success" }, row.original.status?.name) }
{ id: "actions", enableSorting: false,
  cell: ({ row }: any) => h(TableActionMenu, {}, {
    trigger: () => h("button", { class: "btn btn-ghost btn-xs btn-square" }, [h(EllipsisVerticalIcon, { class: "w-4 h-4" })]),
    default: ({ close }: any) => [h("li", {}, [h("button", { onClick: () => { close(); handleEdit(row.original); } }, "Edit")])],
  }) }
```

API: `?page=1&limit=10&search=...&filter[field]=value` → `{ data: T[], total: number }`
Row click: `<DataTable @row-click="handleRowClick" />` | Manual: `<DataTable :data="localData" :total="n" table-name="local" />`

## References
- `references/column-types.md` | `references/cell-renderers.md` | `references/api-integration.md` | `docs/FRONTEND-LAYERS.md`
