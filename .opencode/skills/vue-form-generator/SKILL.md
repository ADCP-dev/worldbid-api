---
name: vue-form-generator
description: |-
  Create Vue forms with Zod validation using base UI components. Use for CRUD forms, settings pages, profile editors.
  Use proactively when users need to create/edit forms with validation.

  Examples:
  - user: "Create a user form" → build form with Zod schema and base components
  - user: "Add validation to my form" → add Zod schema and error handling
  - user: "Build a settings page" → create form with switches, selects, inputs
  - user: "Form for creating products" → create form with all field types
---

# Vue Form Generator

Create Vue forms with Zod validation using `@/modules/base/ui-app/components/form/*` components.

## Overview

Forms use:

- **Zod** for schema validation
- **Base components** for consistent UI
- **vue-sonner** for toast notifications

## Available Components

Import path: `@/modules/base/ui-app/components/form/`

| Component            | v-model                | Key Props                             | Use For                    |
| -------------------- | ---------------------- | ------------------------------------- | -------------------------- |
| `FormInput`          | `string \| number`     | type, placeholder, required           | Text, email, number inputs |
| `FormSelect`         | `string \| number`     | options[], required, showCreateButton | Dropdown selects           |
| `FormSearchSelect`   | `string \| number`     | options[], placeholder                | Select with search         |
| `FormSwitch`         | `boolean`              | variant, description                  | Toggle switches            |
| `FormDate`           | `DateValue \| null`    | required                              | Date picker                |
| `FormPassword`       | `string`               | required                              | Password input             |
| `FormTime`           | `string`               | -                                     | Time picker                |
| `FormFile`           | `File \| null`         | -                                     | Single file upload         |
| `FormMultipleFile`   | `File[]`               | -                                     | Multiple file upload       |
| `FormMultipleSelect` | `(string \| number)[]` | options[]                             | Multi-select               |

## Component Props

All form components accept:

| Prop          | Type      | Description              |
| ------------- | --------- | ------------------------ |
| `v-model`     | varies    | Form value               |
| `label`       | `string`  | Field label              |
| `error`       | `string`  | Error message to display |
| `required`    | `boolean` | Mark field as required   |
| `disabled`    | `boolean` | Disable field            |
| `description` | `string`  | Helper text below field  |

FormSelect/FormSearchSelect additional props:

| Prop               | Type                                           | Description            |
| ------------------ | ---------------------------------------------- | ---------------------- |
| `options`          | `{ label: string; value: string \| number }[]` | Select options         |
| `placeholder`      | `string`                                       | Placeholder text       |
| `showCreateButton` | `boolean`                                      | Show create new option |
| `createButtonText` | `string`                                       | Create button label    |
| `onCreateClick`    | `() => void`                                   | Create button handler  |

## Step-by-Step

### Step 1: Define Zod Schema

```typescript
import { z } from "zod";

const formSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.string().min(1, "Please select a role"),
  notifications: z.boolean().default(false).optional(),
  bio: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
```

### Step 2: Create Form State

```typescript
const form = ref<FormValues>({
  username: "",
  email: "",
  role: "",
  notifications: false,
  bio: "",
});

const errors = ref<Record<string, string>>({});
```

### Step 3: Add Components to Template

```vue
<template>
  <form @submit.prevent="onSubmit" class="space-y-6">
    <FormInput
      v-model="form.username"
      label="Username"
      placeholder="Enter username"
      :error="errors.username"
      required
      description="This is your public display name."
    />

    <FormInput
      v-model="form.email"
      label="Email"
      type="email"
      placeholder="example@email.com"
      :error="errors.email"
      required
    />

    <FormSelect
      v-model="form.role"
      label="Role"
      :options="roles"
      placeholder="Select a role"
      :error="errors.role"
      required
    />

    <FormSwitch
      v-model="form.notifications"
      label="Enable notifications"
      description="Receive alerts about important activity."
    />
  </form>
</template>
```

### Step 4: Handle Submit with Validation

```typescript
import { toast } from "vue-sonner";

function onSubmit() {
  errors.value = {};
  const result = formSchema.safeParse(form.value);

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      errors.value[issue.path[0] as string] = issue.message;
    });
    toast.error("Form validation failed");
    return;
  }

  toast.success("Form submitted!", {
    description: JSON.stringify(form.value, null, 2),
  });
}
```

## Zod Validation Patterns

### String Required

```typescript
name: z.string().min(1, "Name is required");
```

### Email

```typescript
email: z.string().email("Invalid email");
```

### String with Min/Max

```typescript
username: z.string().min(2).max(50);
```

### Optional String

```typescript
bio: z.string().optional();
```

### Boolean with Default

```typescript
active: z.boolean().default(true).optional();
```

### Number

```typescript
age: z.number().min(18);
```

### Enum/String Union

```typescript
role: z.enum(["admin", "user", "manager"]);
```

## Form Structure Template

```vue
<script setup lang="ts">
import { z } from "zod";
import { toast } from "vue-sonner";
import { ref } from "vue";
import FormInput from "@/modules/base/ui-app/components/form/FormInput.vue";
import FormSelect from "@/modules/base/ui-app/components/form/FormSelect.vue";
import FormSwitch from "@/modules/base/ui-app/components/form/FormSwitch.vue";

const formSchema = z.object({
  // ... define fields
});

type FormValues = z.infer<typeof formSchema>;

const form = ref<FormValues>({
  /* initial values */
});
const errors = ref<Record<string, string>>({});

function onSubmit() {
  errors.value = {};
  const result = formSchema.safeParse(form.value);

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      errors.value[issue.path[0] as string] = issue.message;
    });
    toast.error("Validation failed");
    return;
  }

  // Submit logic
  toast.success("Success!");
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="space-y-6">
    <!-- Form components here -->
  </form>
</template>
```

## Common Patterns

### Select with Static Options

```typescript
const roles = [
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
  { value: "manager", label: "Manager" },
];
```

### Select with Create Button

```vue
<FormSelect
  v-model="form.category"
  label="Category"
  :options="categories"
  show-create-button
  create-button-text="Add Category"
  :on-create-click="openCategoryDialog"
/>
```

### Date Field (requires @internationalized/date)

```typescript
import { CalendarDate } from "@internationalized/date";

const form = ref({
  date: null as CalendarDate | null,
});
```

## See Also

- `references/components.md` - Detailed component props
- `references/zod-patterns.md` - Common Zod validation patterns
- `references/examples.md` - Complete form examples
- `docs/FRONTEND-LAYERS.md` - Frontend architecture and UI components overview
