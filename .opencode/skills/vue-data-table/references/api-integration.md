# API Integration Guide

How DataTable integrates with backend APIs.

## Request Format

When an `endpoint` is provided, DataTable automatically fetches data with pagination, sorting, and filtering.

### Request Parameters

| Parameter       | Example          | Description              |
| --------------- | ---------------- | ------------------------ |
| `page`          | `1`              | Current page (1-indexed) |
| `limit`         | `10`             | Items per page           |
| `search`        | `"john"`         | Global search term       |
| `filter[field]` | `filter[role]=1` | Column-specific filters  |

### Example Request

```
GET /api/users?page=1&limit=10&search=john&filter[role]=1
```

### Request Building

DataTable builds the query string internally:

```typescript
const params: Record<string, unknown> = {
  page: state.value.pageIndex + 1, // Convert 0-indexed to 1-indexed
  limit: state.value.pageSize,
};

if (state.value.columnFilters.length > 0) {
  params.filter = {};
  state.value.columnFilters.forEach((f: ColumnFilter) => {
    params.filter[f.id] = f.value;
  });
}

if (state.value.globalFilter) {
  params.search = state.value.globalFilter;
}
```

## Response Format

### Expected Response

```typescript
{
  data: TData[],      // Array of items
  total: number,      // Total count for pagination
}
```

### Example Response

```json
{
  "data": [
    { "id": 1, "name": "John Doe", "email": "john@example.com" },
    { "id": 2, "name": "Jane Smith", "email": "jane@example.com" }
  ],
  "total": 42
}
```

## Backend Implementation

### Express.js Example

```typescript
app.get("/api/users", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const filters = req.query.filter as Record<string, string>;

  const query: any = {};

  // Apply search
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  // Apply filters
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "" && value !== undefined) {
        query[key] = value;
      }
    });
  }

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(query).skip(skip).limit(limit),
    User.countDocuments(query),
  ]);

  res.json({ data: users, total });
});
```

### NestJS Example

```typescript
@Controller("users")
export class UsersController {
  @Get()
  async findAll(@Query() query: PaginationQuery) {
    const { page, limit, search, filter } = query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== "" && value !== undefined) {
          where[key] = value;
        }
      });
    }

    const [data, total] = await this.prisma.user.findManyAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }
}
```

### FastAPI Example

```python
@app.get("/api/users")
async def get_users(
    page: int = 1,
    limit: int = 10,
    search: str = None,
    filter: dict = None
):
    query = db.query(User)

    if search:
        query = query.filter(
            or_(
                User.name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%")
            )
        )

    if filter:
        for key, value in filter.items():
            if value:
                query = query.filter(getattr(User, key) == value)

    total = query.count()
    users = query.offset((page - 1) * limit).limit(limit).all()

    return {"data": users, "total": total}
```

## Without Endpoint (Manual Mode)

Pass data directly when you control the data fetching:

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import DataTable from "@/modules/base/ui-app/components/data-table/DataTable.vue";

const localData = ref([]);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  const response = await fetchUsers(); // Your custom fetch
  localData.value = response.data;
  loading.value = false;
});

const columns = computed(() => [
  // ... columns
]);
</script>

<template>
  <DataTable
    :columns="columns"
    :data="localData"
    :total="localData.length"
    table-name="manual-table"
  />
</template>
```

## Manual with Total Count

When using manual data but with separate total:

```vue
<DataTable
  :columns="columns"
  :data="items"
  :total="totalCount"
  :manual="true"
  table-name="manual-table"
/>
```

## Refresh Trigger

Use `refreshKey` to trigger data refresh when data changes elsewhere:

```vue
<script setup lang="ts">
const refreshKey = ref(0);

const handleSomething = async () => {
  await doSomething();
  refreshKey.value++; // Triggers DataTable to refetch
};
</script>

<template>
  <DataTable
    ref="tableRef"
    :columns="columns"
    endpoint="items"
    :refresh-key="refreshKey"
    table-name="items-table"
  />
</template>
```

## Programmatic Refresh

Access DataTable ref to call fetchData directly:

```vue
<script setup lang="ts">
const tableRef = ref<any>(null);

// Refresh after external change
const handleUpdate = async () => {
  await updateItem();
  tableRef.value?.fetchData();
};
</script>

<template>
  <DataTable
    ref="tableRef"
    :columns="columns"
    endpoint="items"
    table-name="items-table"
  />
</template>
```

## Error Handling

DataTable logs errors to console. Add error handling via custom wrapper:

```typescript
const fetchData = async () => {
  try {
    loading.value = true;
    const response = await fetchWrapper.get(`${baseURL}/${props.endpoint}`);
    internalData.value = response.data || [];
    totalCount.value = response.total ?? 0;
  } catch (error) {
    console.error("Failed to fetch table data:", error);
    toast.error("Failed to load data");
  } finally {
    loading.value = false;
  }
};
```

## State Persistence

DataTable uses `useTableStateStore` to persist:

- Sorting
- Column filters
- Global filter
- Column visibility
- Page index and size

Each table is identified by `tableName` prop.

```vue
<DataTable
  :columns="columns"
  endpoint="users"
  table-name="admin-users-table"  <!-- Unique per page -->
/>
```

## Multi-Table on Same Page

Use different `tableName` for each DataTable:

```vue
<DataTable
  :columns="userColumns"
  endpoint="users"
  table-name="admin-users-table"
/>

<DataTable
  :columns="orderColumns"
  endpoint="orders"
  table-name="admin-orders-table"
/>
```

## Filter State

Filters are applied when:

1. User types in filter input
2. Debounced 300ms
3. Page resets to 0

Use `manual` prop for server-side filter handling:

```vue
<DataTable
  :columns="columns"
  endpoint="items"
  :manual="true"
  table-name="items"
/>
```
