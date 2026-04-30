# UI Components Reference

> Auto-generated via `node scripts/generate-ui-components-list.js`
> Run the script to regenerate when components are added/removed.

## Form Components

All imports from `@base/ui-app/components/form/`:

| Component | Import | Description |
|-----------|--------|-------------|
| `FormInput` | `@base/ui-app/components/form/FormInput.vue` | Text input with Zod validation |
| `FormTextArea` | `@base/ui-app/components/form/FormTextArea.vue` | Multi-line text area |
| `FormSelect` | `@base/ui-app/components/form/FormSelect.vue` | Single-select dropdown |
| `FormSearchSelect` | `@base/ui-app/components/form/FormSearchSelect.vue` | Searchable select with async options |
| `FormMultipleSelect` | `@base/ui-app/components/form/FormMultipleSelect.vue` | Multi-select with tags |
| `FormDate` | `@base/ui-app/components/form/FormDate.vue` | Date picker |
| `FormTime` | `@base/ui-app/components/form/FormTime.vue` | Time picker |
| `FormPassword` | `@base/ui-app/components/form/FormPassword.vue` | Password input with toggle visibility |
| `FormSwitch` | `@base/ui-app/components/form/FormSwitch.vue` | Toggle switch |
| `FormFile` | `@base/ui-app/components/form/FormFile.vue` | Single file upload |
| `FormMultipleFile` | `@base/ui-app/components/form/FormMultipleFile.vue` | Multiple file upload |

## Data Table Components

All imports from `@base/ui-app/components/data-table/`:

| Component | Import | Description |
|-----------|--------|-------------|
| `DataTable` | `@base/ui-app/components/data-table/DataTable.vue` | Main table with pagination, sorting, filtering |
| `DataTableComboboxFilter` | `@base/ui-app/components/data-table/filters/DataTableComboboxFilter.vue` | Combobox column filter |
| `DataTableColumnHeader` | `@base/ui-app/components/data-table/filters/DataTableColumnHeader.vue` | Sortable column header |
| `SortableHeader` | `@base/ui-app/components/data-table/filters/SortableHeader.vue` | Alternative sort header |
| `EditButton` | `@base/ui-app/components/data-table/buttons/EditButton.vue` | Row edit action button |
| `ViewButton` | `@base/ui-app/components/data-table/buttons/ViewButton.vue` | Row view action button |
| `DeleteButton` | `@base/ui-app/components/data-table/buttons/DeleteButton.vue` | Row delete action button |

## Rich Editor

| Component | Import | Description |
|-----------|--------|-------------|
| `RichEditor` | `@base/ui-app/components/rich-editor/RichEditor.vue` | Tiptap-based WYSIWYG editor |

## Other Modules

| Module | Path | Description |
|--------|------|-------------|
| `Calendar` | `@base/ui-app/components/calendar/` | Calendar components |
| `Kanban` | `@base/ui-app/components/kanban/` | Kanban board components |
| `Storage` | `@base/ui-app/components/storage/` | File storage components |

⚠️ **NEVER create custom components if a base component exists.** Always import from `@base/ui-app/`.
