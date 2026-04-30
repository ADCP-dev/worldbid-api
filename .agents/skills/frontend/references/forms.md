# Frontend Form Patterns

> Detail for `frontend` skill. See the SKILL.md for core rules.

## Form with Zod Validation

```vue
<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import FormInput from '@base/ui-app/components/form/FormInput.vue'
import FormSelect from '@base/ui-app/components/form/FormSelect.vue'

const schema = toTypedSchema(z.object({
  name: z.string().min(2, 'Min 2 characters'),
  email: z.string().email('Invalid email'),
  role: z.enum(['admin', 'user', 'viewer']),
}))

const { handleSubmit, errors } = useForm({ validationSchema: schema })

const onSubmit = handleSubmit(async (values) => {
  await api.create(values)
})
</script>

<template>
  <form @submit="onSubmit">
    <FormInput name="name" label="Name" />
    <FormInput name="email" label="Email" type="email" />
    <FormSelect name="role" label="Role" :options="roleOptions" />
    <button type="submit">Save</button>
  </form>
</template>
```

## Form with Multiple Select

```vue
<script setup lang="ts">
import FormMultipleSelect from '@base/ui-app/components/form/FormMultipleSelect.vue'

const tagOptions = [
  { value: '1', label: 'JavaScript' },
  { value: '2', label: 'TypeScript' },
  { value: '3', label: 'Vue' },
]
</script>

<template>
  <FormMultipleSelect
    name="tags"
    label="Tags"
    :options="tagOptions"
  />
</template>
```

## Form with File Upload

```vue
<script setup lang="ts">
import FormFile from '@base/ui-app/components/form/FormFile.vue'
import FormMultipleFile from '@base/ui-app/components/form/FormMultipleFile.vue'
</script>

<template>
  <!-- Single file -->
  <FormFile name="avatar" label="Avatar" accept="image/*" />

  <!-- Multiple files -->
  <FormMultipleFile name="gallery" label="Gallery" accept="image/*" />
</template>
```

## Schema Definition Pattern
```typescript
// schemas/user.schema.ts
import { z } from 'zod'

export const userFormSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().optional(),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
  isActive: z.boolean().default(true),
})

export type UserFormValues = z.infer<typeof userFormSchema>
```
