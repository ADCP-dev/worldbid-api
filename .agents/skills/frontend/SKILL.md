---
name: frontend
description: |-
  Foundation frontend development — Nuxt 3 + Vue 3 + Tailwind + DaisyUI + TanStack. Use for ALL frontend work: forms, data tables, pages, components, and UI patterns.

  Use proactively when working on apps/front/, creating pages, forms, tables, or Vue components.

  Examples:
  - user: "Create a user form" → use FormInput, FormSelect from @base/ui-app/
  - user: "Build a data table" → use DataTable from @base/ui-app/
  - user: "Add a new page" → create in pages/, use Nuxt routing
---

# Frontend — Foundation

## ⚠️ Core Rules

- **SIEMPRE** usar componentes `@base/ui-app/` — NUNCA crear custom si ya existe uno base
- **NUNCA** escribir forms/tables desde cero — usar componentes base
- **SIEMPRE** usar path aliases: `@/`, `@base`, `@cms`, `@landing`
- **NUNCA** rutas relativas largas (`../../../`)
- **NUNCA** `console.log` — usar `vue-sonner` toast o logger del proyecto
- Forms con Zod validation + componentes base
- DataTables con TanStack Vue Table + componentes base

## UI Components

> See `references/components.md` for the complete component catalog.
> Run `node scripts/generate-ui-components-list.js` to regenerate.

All imports from `@base/ui-app/components/`. Key components:

**Form:** `FormInput`, `FormTextArea`, `FormSelect`, `FormSearchSelect`, `FormMultipleSelect`, `FormDate`, `FormTime`, `FormPassword`, `FormSwitch`, `FormFile`, `FormMultipleFile`

**DataTable:** `DataTable`, `DataTableComboboxFilter`, `DataTableColumnHeader`, `SortableHeader`, `EditButton`, `ViewButton`, `DeleteButton`

**Rich editor:** `RichEditor`

**⚠️ NUNCA crear componente custom si ya existe uno en `@base/ui-app/`.**

## Patterns

### Form Pattern (Zod + Componentes Base)

```vue
<script setup lang="ts">
import { z } from "zod";
import { toast } from "vue-sonner";
import FormInput from "@base/ui-app/components/form/FormInput.vue";
import FormSelect from "@base/ui-app/components/form/FormSelect.vue";

const schema = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum(["admin", "user"]),
});

const form = ref({ email: "", role: "user" });
const errors = ref<Record<string, string>>({});

function onSubmit() {
  errors.value = {};
  const r = schema.safeParse(form.value);
  if (!r.success) {
    r.error.issues.forEach(
      (i) => (errors.value[i.path[0] as string] = i.message)
    );
    toast.error("Corregí errores");
    return;
  }
  toast.success("OK");
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="space-y-6">
    <FormInput v-model="form.email" label="Email" :error="errors.email" required />
    <FormSelect
      v-model="form.role"
      label="Rol"
      :options="[
        { value: 'admin', label: 'Admin' },
        { value: 'user', label: 'User' },
      ]"
    />
  </form>
</template>
```

### DataTable Pattern

```vue
<script setup lang="ts">
import { computed } from "vue";
import DataTable from "@base/ui-app/components/data-table/DataTable.vue";

const columns = computed(() => [
  { accessorKey: "id", headerName: "ID", filterType: "number" },
  { accessorKey: "email", headerName: "Email", filterType: "string" },
  { accessorKey: "role.name", headerName: "Rol", filterType: "select",
    options: [{ value: "admin", label: "Admin" }, { value: "user", label: "User" }] },
]);
</script>

<template>
  <DataTable ref="tableRef" :columns="columns" endpoint="users" table-name="admin-users" />
</template>
```

### Nuxt Page Pattern

```vue
<script setup lang="ts">
definePageMeta({
  title: "Users",
  layout: "default",
});
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Users</h1>
    <!-- content -->
  </div>
</template>
```

## Links

- `references/components.md` — Catálogo completo de componentes UI
- `references/forms.md` — Patrones de formularios (Zod + componentes base)
- `references/tables.md` — Patrones de DataTable (TanStack + acciones)
- `docs/FRONTEND-LAYERS.md` — Nuxt layers y estructura del frontend
- `docs/TYPESCRIPT-GUIDELINES.md` — Reglas TypeScript del proyecto
- `docs/modules/auth.md` — Auth (stores, guards, middlewares)
