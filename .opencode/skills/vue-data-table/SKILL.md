---
name: vue-data-table
description: |-
  Create paginated data tables with TanStack Vue Table and backend integration. Use for admin panels, list pages, CRUD interfaces.
  Use proactively when users need to display tabular data with filtering, sorting, pagination.

  Examples:
  - user: "Create a users table" → build table with columns, filters, actions
  - user: "Add pagination to my list" → implement DataTable with API integration
  - user: "Build an admin panel table" → create table with filters, sorting, action menus
  - user: "Table for products" → implement DataTable with select filters, cell renderers
---

# Vue Data Table

Create paginated data tables using `@/modules/base/ui-app/components/data-table/DataTable.vue`.

## Overview

DataTable features:

- **TanStack Vue Table** for table logic
- **Backend integration** via `endpoint` prop
- **Filtering** - string, number, date, select, combobox, boolean
- **Sorting** - automatic column sorting
- **Pagination** - server-side pagination
- **Column visibility** - toggle columns on/off
- **Cell renderers** - custom cell content with Vue `h()`

## Basic Usage

```vue
<script setup lang="ts">
import { ref, computed, h } from "vue";
import DataTable from "@/modules/base/ui-app/components/data-table/DataTable.vue";

const columns = computed(() => [
  {
    accessorKey: "id",
    headerName: "ID",
    filterType: "number",
  },
  {
    accessorKey: "name",
    headerName: "Name",
    filterType: "string",
  },
  {
    accessorKey: "email",
    headerName: "Email",
    filterType: "string",
  },
]);
</script>

<template>
  <DataTable
    ref="tableRef"
    :columns="columns"
    endpoint="users"
    table-name="admin-users-table"
  />
</script>
```

## Column Definition

### Basic Column

```typescript
{
  accessorKey: "firstName",
  headerName: "First Name",
  header: "First Name",
  filterType: "string",
}
```

### Column with Custom Cell

```typescript
{
  accessorKey: "status.id",
  id: "status.id",
  headerName: "Status",
  filterType: "select",
  options: [
    { value: "1", label: "Active" },
    { value: "2", label: "Inactive" },
  ],
  cell: ({ row }: any) => {
    const statusName = row.original.status?.name || "Unknown";
    const badgeClass = statusName === "Active" ? "badge-success" : "badge-neutral";
    return h("div", { class: ["badge", badgeClass] }, statusName);
  },
}
```

### Actions Column

```typescript
{
  id: "actions",
  headerName: "Actions",
  header: "Actions",
  enableSorting: false,
  cell: ({ row }: any) => {
    const item = row.original;
    return h(TableActionMenu, {}, {
      trigger: () => h("button", { class: "btn btn-ghost btn-xs btn-square" }, [
        h(EllipsisVerticalIcon, { class: "w-4 h-4" }),
      ]),
      default: ({ close }: { close: () => void }) => [
        h("li", {}, [
          h("button", { onClick: () => { close(); handleEdit(item); } }, [
            h(EditIcon, { class: "w-4 h-4" }), "Edit",
          ]),
        ]),
        h("li", { class: "text-error" }, [
          h("button", { onClick: () => { close(); handleDelete(item); } }, [
            h(Trash2Icon, { class: "w-4 h-4" }), "Delete",
          ]),
        ]),
      ],
    });
  },
}
```

## Filter Types

| filterType   | Description       | Filter UI              |
| ------------ | ----------------- | ---------------------- |
| `"string"`   | Text filter       | Input field            |
| `"number"`   | Numeric filter    | Number input           |
| `"date"`     | Date filter       | Date picker            |
| `"select"`   | Single select     | Dropdown select        |
| `"combobox"` | Searchable select | Combobox with search   |
| `"boolean"`  | Yes/No filter     | Select with yes/no/all |

### Select Filter Example

```typescript
{
  accessorKey: "role.id",
  id: "role.id",
  headerName: "Role",
  filterType: "select",
  options: [
    { value: "", label: "All" },
    { value: "1", label: "Admin" },
    { value: "2", label: "User" },
  ],
}
```

### Combobox Filter Example

```typescript
{
  accessorKey: "category.id",
  id: "category.id",
  headerName: "Category",
  filterType: "combobox",
  options: [
    { value: "1", label: "Electronics" },
    { value: "2", label: "Clothing" },
    { value: "3", label: "Home" },
  ],
}
```

## API Integration

### DataTable Props

| Prop         | Type            | Description                       |
| ------------ | --------------- | --------------------------------- |
| `columns`    | `MyColumnDef[]` | Column definitions                |
| `endpoint`   | `string`        | API endpoint for data             |
| `tableName`  | `string`        | Unique table identifier for state |
| `ref`        | -               | Exposes `fetchData()` method      |
| `refreshKey` | `number`        | Trigger refresh when changes      |

### API Request Format

DataTable sends these query parameters:

| Param           | Example          | Description              |
| --------------- | ---------------- | ------------------------ |
| `page`          | `1`              | Current page (1-indexed) |
| `limit`         | `10`             | Items per page           |
| `search`        | `"john"`         | Global search string     |
| `filter[field]` | `filter[role]=1` | Column filters           |

### API Response Format

```typescript
{
  data: TData[],      // Array of items
  total: number,      // Total count for pagination
}
```

## Complete Example with CRUD

### Script Setup

```vue
<script setup lang="ts">
import { ref, computed, h } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import {
  PlusIcon,
  EditIcon,
  Trash2Icon,
  EllipsisVerticalIcon,
} from "lucide-vue-next";
import DataTable from "@/modules/base/ui-app/components/data-table/DataTable.vue";
import TableActionMenu from "@/components/ui/TableActionMenu.vue";
import MyFormDialog from "@/components/MyFormDialog.vue";

const { t } = useI18n();

const tableRef = ref<any>(null);
const formDialogRef = ref<any>(null);
const selectedItem = ref<any>(null);

const refreshTable = () => {
  tableRef.value?.fetchData();
};

const handleCreate = () => {
  selectedItem.value = null;
  formDialogRef.value?.openDialog();
};

const handleEdit = (item: any) => {
  selectedItem.value = item;
  formDialogRef.value?.openDialog();
};

const handleDelete = async (item: any) => {
  if (confirm(t("messages.deleteConfirm"))) {
    try {
      await deleteItem(item.id);
      toast.success(t("messages.deleteSuccess"));
      refreshTable();
    } catch (error) {
      toast.error(t("messages.deleteError"));
    }
  }
};

const columns = computed(() => [
  {
    accessorKey: "id",
    headerName: t("table.id"),
    filterType: "number",
  },
  {
    accessorKey: "name",
    headerName: t("table.name"),
    filterType: "string",
  },
  {
    accessorKey: "email",
    headerName: t("table.email"),
    filterType: "string",
  },
  {
    accessorKey: "role.id",
    id: "role.id",
    headerName: t("table.role"),
    filterType: "select",
    options: [
      { value: "", label: t("table.all") },
      { value: "1", label: t("roles.admin") },
      { value: "2", label: t("roles.user") },
    ],
    cell: ({ row }: any) => {
      const role = row.original.role?.name || "User";
      return h("div", { class: "badge badge-outline" }, role);
    },
  },
  {
    id: "actions",
    headerName: t("table.actions"),
    enableSorting: false,
    cell: ({ row }: any) => {
      const item = row.original;
      return h(
        TableActionMenu,
        {},
        {
          trigger: () =>
            h("button", { class: "btn btn-ghost btn-xs btn-square" }, [
              h(EllipsisVerticalIcon, { class: "w-4 h-4" }),
            ]),
          default: ({ close }: { close: () => void }) => [
            h("li", {}, [
              h(
                "button",
                {
                  onClick: () => {
                    close();
                    handleEdit(item);
                  },
                },
                [h(EditIcon, { class: "w-4 h-4" }), t("actions.edit")],
              ),
            ]),
            h("li", { class: "text-error" }, [
              h(
                "button",
                {
                  onClick: () => {
                    close();
                    handleDelete(item);
                  },
                },
                [h(Trash2Icon, { class: "w-4 h-4" }), t("actions.delete")],
              ),
            ]),
          ],
        },
      );
    },
  },
]);
</script>

<template>
  <div class="p-1 md:p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">{{ t("title") }}</h1>
      <button class="btn btn-primary" @click="handleCreate">
        <PlusIcon class="w-4 h-4 mr-2" />
        {{ t("actions.create") }}
      </button>
    </div>

    <DataTable
      ref="tableRef"
      :columns="columns"
      endpoint="items"
      table-name="admin-items-table"
    />

    <MyFormDialog
      ref="formDialogRef"
      :item="selectedItem"
      @saved="refreshTable"
    />
  </div>
</template>
```

## Row Click

Enable row click to navigate or open details:

```vue
<DataTable
  ref="tableRef"
  :columns="columns"
  endpoint="items"
  @row-click="handleRowClick"
/>
```

```typescript
const handleRowClick = (item: any) => {
  router.push(`/items/${item.id}`);
};
```

## Manual Data (No API)

Pass data directly without endpoint:

```vue
<DataTable
  :columns="columns"
  :data="localData"
  :total="localData.length"
  table-name="local-table"
/>
```

## See Also

- `references/column-types.md` - Detailed filter types and options
- `references/cell-renderers.md` - Cell renderer patterns
- `references/api-integration.md` - Backend API integration guide
- `docs/FRONTEND-LAYERS.md` - Frontend architecture and UI components overview
