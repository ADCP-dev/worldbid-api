---
name: vue-form-generator
description: Create Vue forms with Zod validation using base UI components. Use for CRUD forms, settings pages, profile editors.
---
# Vue Form Generator

Crear forms con Zod + componentes base. ⚠️ **NUNCA escribir forms desde cero.**

## Componentes (import: `@/modules/base/ui-app/components/form/`)

| Componente | v-model | Uso |
|---|---|---|
| `FormInput` | string\|number | Texto, email, número |
| `FormSelect` | string\|number | Dropdown |
| `FormSearchSelect` | string\|number | Select con búsqueda |
| `FormSwitch` | boolean | Toggle |
| `FormDate` | DateValue\|null | Date picker |
| `FormPassword` | string | Password |
| `FormTime` | string | Time picker |
| `FormFile` | File\|null | File upload |
| `FormMultipleFile` | File[] | Multi file |
| `FormMultipleSelect` | (string\|number)[] | Multi-select |

Props comunes: `label`, `error`, `required`, `disabled`, `description`.

## Ejemplo Mínimo

```vue
<script setup lang="ts">
import { z } from "zod"; import { toast } from "vue-sonner";
import FormInput from "@/modules/base/ui-app/components/form/FormInput.vue";
const schema = z.object({ email: z.string().email() });
const form = ref({ email: "" }); const errors = ref<Record<string, string>>({});
function onSubmit() {
  errors.value = {}; const r = schema.safeParse(form.value);
  if (!r.success) { r.error.issues.forEach(i => errors.value[i.path[0] as string] = i.message); toast.error("Fail"); return; }
  toast.success("OK");
}
</script>
<template>
  <form @submit.prevent="onSubmit" class="space-y-6">
    <FormInput v-model="form.email" label="Email" :error="errors.email" required />
  </form>
</template>
```

## Zod — Patrones Comunes
```typescript
z.string().min(1, "Required") | z.string().email() | z.string().optional() | z.boolean().default(true) | z.number().min(18) | z.enum(["a","b"])
```

## References
- `references/components.md` — Props | `references/zod-patterns.md` — Patrones | `references/examples.md` — Ejemplos | `docs/FRONTEND-LAYERS.md`
