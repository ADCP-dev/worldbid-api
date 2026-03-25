# Column Types Reference

Detailed reference for column definitions and filter types.

## Column Definition Type

```typescript
import type { MyColumnDef } from "@/modules/base/ui-app/components/data-table/types";

type MyColumnDef<TData, TValue = unknown> = ColumnDef<TData, TValue> & {
  options?: FilterOption[];
  headerName?: string;
  filterType?: FilterType;
};

interface FilterOption {
  value: string | number | boolean;
  label: string;
}

type FilterType =
  | "number"
  | "date"
  | "string"
  | "select"
  | "boolean"
  | "combobox";
```

## Filter Types

### string

Text filter with partial matching.

```typescript
{
  accessorKey: "name",
  headerName: "Name",
  filterType: "string",
}
```

### number

Numeric filter for IDs, quantities, prices.

```typescript
{
  accessorKey: "id",
  headerName: "ID",
  filterType: "number",
}
```

### date

Date filter with native date picker.

```typescript
{
  accessorKey: "createdAt",
  headerName: "Created",
  filterType: "date",
}
```

### select

Single-select dropdown filter.

```typescript
{
  accessorKey: "status.id",
  id: "status.id",
  headerName: "Status",
  filterType: "select",
  options: [
    { value: "", label: "All" },
    { value: "1", label: "Active" },
    { value: "2", label: "Inactive" },
  ],
}
```

### combobox

Searchable select filter (uses DataTableComboboxFilter).

```typescript
{
  accessorKey: "category.id",
  id: "category.id",
  headerName: "Category",
  filterType: "combobox",
  options: [
    { value: "1", label: "Electronics" },
    { value: "2", label: "Clothing" },
    { value: "3", label: "Home & Garden" },
  ],
}
```

### boolean

Yes/No/All filter.

```typescript
{
  accessorKey: "isActive",
  headerName: "Active",
  filterType: "boolean",
}
```

## Column Properties

### accessorKey

```typescript
accessorKey: "firstName"; // Simple property
accessorKey: "address.city"; // Nested property
```

### id

Unique identifier for the column (required for nested accessors or custom columns).

```typescript
id: "status.id"; // When using nested accessor
id: "actions"; // For action columns
```

### headerName

Human-readable name for the column header.

```typescript
headerName: "First Name";
```

### header

The actual header content (can be render function). Defaults to headerName if not provided.

```typescript
header: "First Name";
// or with translation
header: t("table.firstName");
```

### filterType

Type of filter to use for this column.

```typescript
filterType: "string"; // Default text input
filterType: "number"; // Number input
filterType: "date"; // Date picker
filterType: "select"; // Dropdown select
filterType: "combobox"; // Searchable select
filterType: "boolean"; // Yes/No/All select
```

### options

Options for select/boolean filter types.

```typescript
options: [
  { value: "", label: "All" },
  { value: "1", label: "Active" },
  { value: "2", label: "Inactive" },
];
```

### enableSorting

Enable/disable sorting for a column.

```typescript
enableSorting: false; // Disable sorting (e.g., for action columns)
```

### enableGlobalFilter

Include/exclude from global search.

```typescript
enableGlobalFilter: false; // Exclude from search
```

### cell

Custom cell renderer function.

```typescript
cell: ({ row, column, getValue }: any) => {
  const value = getValue();
  return h("span", { class: "text-primary" }, value);
};
```

## Common Patterns

### Status Badge Column

```typescript
{
  accessorKey: "status.id",
  id: "status.id",
  headerName: "Status",
  filterType: "select",
  options: [
    { value: "", label: "All Statuses" },
    { value: "1", label: "Active" },
    { value: "2", label: "Inactive" },
  ],
  cell: ({ row }: any) => {
    const statusName = row.original.status?.name || "Unknown";
    const isActive = statusName === "Active";
    return h(
      "div",
      { class: ["badge", isActive ? "badge-success" : "badge-neutral"] },
      statusName
    );
  },
}
```

### Role Badge Column

```typescript
{
  accessorKey: "role.id",
  id: "role.id",
  headerName: "Role",
  filterType: "select",
  options: [
    { value: "", label: "All Roles" },
    { value: "1", label: "Admin" },
    { value: "2", label: "User" },
    { value: "3", label: "Manager" },
  ],
  cell: ({ row }: any) => {
    const role = row.original.role?.name || "User";
    const roleClass =
      role === "Admin" ? "badge-error" :
      role === "Manager" ? "badge-warning" :
      "badge-ghost";
    return h("div", { class: ["badge", roleClass] }, role);
  },
}
```

### Avatar + Name Column

```typescript
{
  accessorKey: "avatar",
  id: "avatar",
  headerName: "User",
  filterType: "string",
  cell: ({ row }: any) => {
    const user = row.original;
    return h("div", { class: "flex items-center gap-3" }, [
      h("div", { class: "avatar" }, [
        h("div", { class: "w-8 h-8 rounded-full" },
          h("img", { src: user.avatar || "/default-avatar.png" })
        ),
      ]),
      h("span", {}, user.name),
    ]);
  },
}
```

### Currency Column

```typescript
{
  accessorKey: "price",
  headerName: "Price",
  filterType: "number",
  cell: ({ row }: any) => {
    const value = row.original.price;
    return h("span", { class: "font-mono" },
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value)
    );
  },
}
```

### Boolean Toggle Column

```typescript
{
  accessorKey: "isEnabled",
  id: "isEnabled",
  headerName: "Enabled",
  filterType: "boolean",
  cell: ({ row }: any) => {
    const isEnabled = row.original.isEnabled;
    return h(
      "div",
      { class: ["badge", isEnabled ? "badge-success" : "badge-error"] },
      isEnabled ? "Yes" : "No"
    );
  },
}
```

### Image Column

```typescript
{
  accessorKey: "image",
  headerName: "Image",
  enableSorting: false,
  cell: ({ row }: any) => {
    const src = row.original.image;
    return h("div", { class: "avatar" }, [
      h("div", { class: "w-12 h-12 rounded" },
        h("img", { src: src || "/placeholder.png" })
      ),
    ]);
  },
}
```

### Truncated Text Column

```typescript
{
  accessorKey: "description",
  headerName: "Description",
  filterType: "string",
  cell: ({ row }: any) => {
    const text = row.original.description || "";
    const truncated = text.length > 50 ? text.slice(0, 50) + "..." : text;
    return h("span", { title: text }, truncated);
  },
}
```

### Date Formatted Column

```typescript
{
  accessorKey: "createdAt",
  headerName: "Created",
  filterType: "date",
  cell: ({ row }: any) => {
    const date = new Date(row.original.createdAt);
    return h("span", {},
      date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    );
  },
}
```
