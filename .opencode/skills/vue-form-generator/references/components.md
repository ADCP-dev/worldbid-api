# Form Components Reference

Detailed props for all form components.

## FormInput

```vue
<FormInput
  v-model="form.field"
  label="Field Label"
  type="text | number | email"
  placeholder="Placeholder text"
  :error="errors.field"
  :required="true"
  :disabled="false"
  description="Helper text below the input"
  min="0"
  max="100"
  step="1"
/>
```

**Slots:**

- `icon-start` - Icon on the left inside input
- `icon-end` - Icon on the right inside input

## FormSelect

Searchable dropdown select with keyboard navigation.

```vue
<FormSelect
  v-model="form.role"
  label="Role"
  :options="[
    { value: 'admin', label: 'Admin' },
    { value: 'user', label: 'User' },
  ]"
  placeholder="Select a role"
  :error="errors.role"
  :required="true"
  :disabled="false"
  description="Select the user role"
  :show-create-button="false"
  create-button-text="Create new"
  :create-button-icon="true"
  :on-create-click="handleCreate"
/>
```

## FormSearchSelect

Similar to FormSelect but uses native dropdown instead of details/summary.

```vue
<FormSearchSelect
  v-model="form.category"
  label="Category"
  :options="categories"
  placeholder="Search..."
  :error="errors.category"
  :required="true"
/>
```

## FormSwitch

Toggle switch component.

```vue
<FormSwitch
  v-model="form.enabled"
  label="Enable feature"
  :required="false"
  :disabled="false"
  :error="errors.enabled"
  description="Toggle to enable this feature"
  variant="primary | secondary | accent | neutral | info | success | warning | error"
  :show-icon="false"
/>
```

## FormDate

Date picker using `@internationalized/date`.

```vue
<FormDate
  v-model="form.startDate"
  label="Start Date"
  :required="true"
  :disabled="false"
  :error="errors.startDate"
  placeholder="Select date"
  description="When the event starts"
/>
```

**Requires `CalendarDate` from `@internationalized/date`:**

```typescript
import { CalendarDate } from "@internationalized/date";

const date = ref<CalendarDate | null>(null);
```

## FormPassword

Password input with visibility toggle.

```vue
<FormPassword
  v-model="form.password"
  label="Password"
  :required="true"
  :error="errors.password"
/>
```

## FormTime

Time input.

```vue
<FormTime
  v-model="form.time"
  label="Time"
  :required="false"
  :error="errors.time"
/>
```

## FormFile

Single file upload.

```vue
<FormFile
  v-model="form.document"
  label="Document"
  :required="true"
  :error="errors.document"
/>
```

## FormMultipleFile

Multiple file upload.

```vue
<FormMultipleFile
  v-model="form.attachments"
  label="Attachments"
  :required="false"
  :error="errors.attachments"
/>
```

## FormMultipleSelect

Multi-select dropdown.

```vue
<FormMultipleSelect
  v-model="form.tags"
  label="Tags"
  :options="[
    { value: '1', label: 'Tag 1' },
    { value: '2', label: 'Tag 2' },
  ]"
  :error="errors.tags"
  :required="false"
/>
```
