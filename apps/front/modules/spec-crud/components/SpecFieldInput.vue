<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import type { FieldSpec } from '../composables/useSpecResource'
import FormInput from '@base/ui-app/components/form/FormInput.vue'
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue'
import FormSelect from '@base/ui-app/components/form/FormSelect.vue'
import FormSearchSelect from '@base/ui-app/components/form/FormSearchSelect.vue'
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue'
import FormFile from '@base/ui-app/components/form/FormFile.vue'
import FormMultipleSelect from '@base/ui-app/components/form/FormMultipleSelect.vue'
import FormDate from '@base/ui-app/components/form/FormDate.vue'
import { CalendarDate, type DateValue } from '@internationalized/date'

const props = defineProps<{
  modelValue: unknown
  field: FieldSpec
  resource?: string
  error?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
}>()

const ui = computed(() => props.field.ui ?? {})
const formInput = computed(() => ui.value.formInput ?? 'text')

function emitValue(value: unknown) {
  emit('update:modelValue', value)
}

function numberModel(): number | undefined {
  const v = props.modelValue
  if (v === null || v === undefined || v === '') return undefined
  return Number(v)
}

function updateNumber(value: string | number | undefined) {
  if (value === '' || value === undefined || value === null) {
    emitValue(undefined)
    return
  }
  emitValue(Number(value))
}

function booleanModel(): boolean {
  return !!props.modelValue
}

function updateBoolean(value: boolean | undefined) {
  emitValue(!!value)
}

function dateModel(): DateValue | null {
  const v = props.modelValue
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function updateDate(value: DateValue | null) {
  if (!value) {
    emitValue(undefined)
    return
  }
  const date = new Date(value.year, value.month - 1, value.day)
  emitValue(date.toISOString().split('T')[0])
}

function datetimeModel(): string {
  const v = props.modelValue
  return v ? String(v).slice(0, 16) : ''
}

function updateDatetime(value: string) {
  emitValue(value || undefined)
}

const stringValue = computed<string>({
  get: () => (props.modelValue == null ? '' : String(props.modelValue)),
  set: (val) => emitValue(val === '' ? undefined : val),
})

const selectOptions = computed(() => {
  return (props.field.enum ?? []).map((opt) => ({ label: String(opt), value: opt }))
})

/* ---------- select-async (ref fields) ---------- */
interface RefOption {
  label: string
  value: string | number
}
const asyncOptions = ref<RefOption[]>([])
const asyncLoading = ref(false)

async function loadAsyncOptions() {
  if (!props.field.ref) return
  const { useSpecResource } = await import('../composables/useSpecResource')
  const spec = useSpecResource()
  const labelField = props.field.ref.labelField ?? 'name'
  const valueField = props.field.ref.valueField ?? 'id'
  asyncLoading.value = true
  try {
    asyncOptions.value = await spec.loadRefOptions(
      props.field.ref.resource,
      labelField,
      valueField,
    )
  } catch (e) {
    asyncOptions.value = []
    throw e
  } finally {
    asyncLoading.value = false
  }
}

onMounted(() => {
  if (formInput.value === 'select-async') loadAsyncOptions()
})

watch(formInput, (val) => {
  if (val === 'select-async') loadAsyncOptions()
})

/* ---------- file-upload ---------- */
function updateFile(file: File | null) {
  emitValue(file ?? undefined)
}

/* ---------- many-to-many ---------- */
function manyModel(): Array<string | number> {
  const v = props.modelValue
  if (Array.isArray(v)) return v as Array<string | number>
  return []
}

function updateMany(value: Array<string | number>) {
  emitValue(value)
}

/* ---------- computed ---------- */
const computedValue = computed(() => {
  return props.modelValue == null ? '' : String(props.modelValue)
})

/* ---------- field type mapping ---------- */
const resolvedType = computed(() => {
  const explicit = formInput.value
  if (explicit === 'select-async') return 'select-async'
  if (explicit === 'file-upload') return 'file'
  if (explicit === 'datepicker') return 'datetime'
  if (explicit === 'textarea') return 'text'
  if (explicit === 'select') return 'enum'

  const backendType = props.field.type ?? 'string'
  if (['many-to-many', 'many_to_many', 'm2m'].includes(backendType)) return 'many-to-many'
  if (['computed'].includes(backendType)) return 'computed'
  if (['ref', 'reference', 'relation'].includes(backendType)) return 'ref'
  if (['boolean', 'bool'].includes(backendType)) return 'boolean'
  if (['integer', 'int', 'bigserial'].includes(backendType)) return 'integer'
  if (['decimal', 'float', 'double', 'number'].includes(backendType)) return 'decimal'
  if (['datetime', 'timestamp'].includes(backendType)) return 'datetime'
  if (['date'].includes(backendType)) return 'date'
  if (['text'].includes(backendType)) return 'text'
  if (['enum'].includes(backendType)) return 'enum'
  if (['file', 'image', 'attachment'].includes(backendType)) return 'file'
  return 'string'
})

const fieldLabel = computed(() => props.field.label ?? props.field.name)
const fieldPlaceholder = computed(() => props.field.label ?? props.field.name)

const selectValue = computed({
  get: () => props.modelValue as string | number | undefined,
  set: (val) => emitValue(val === undefined ? undefined : val),
})

const singleRefValue = computed({
  get: () => props.modelValue as string | number | undefined,
  set: (val) => emitValue(val === undefined ? undefined : val),
})
</script>

<template>
  <div class="form-control w-full">
    <!-- string -->
    <FormInput
      v-if="resolvedType === 'string'"
      v-model="stringValue"
      type="text"
      :label="fieldLabel"
      :placeholder="fieldPlaceholder"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
    />

    <!-- text / textarea -->
    <FormTextArea
      v-else-if="resolvedType === 'text'"
      v-model="stringValue"
      :label="fieldLabel"
      :placeholder="fieldPlaceholder"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
      rows="4"
    />

    <!-- integer -->
    <FormInput
      v-else-if="resolvedType === 'integer'"
      :model-value="numberModel()"
      type="number"
      step="1"
      :label="fieldLabel"
      :placeholder="fieldPlaceholder"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
      @update:model-value="updateNumber"
    />

    <!-- decimal -->
    <FormInput
      v-else-if="resolvedType === 'decimal'"
      :model-value="numberModel()"
      type="number"
      step="0.01"
      :label="fieldLabel"
      :placeholder="fieldPlaceholder"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
      @update:model-value="updateNumber"
    />

    <!-- boolean -->
    <FormSwitch
      v-else-if="resolvedType === 'boolean'"
      :model-value="booleanModel()"
      :label="fieldLabel"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
      @update:model-value="updateBoolean"
    />

    <!-- datetime-local -->
    <FormInput
      v-else-if="resolvedType === 'datetime'"
      :model-value="datetimeModel()"
      type="datetime-local"
      :label="fieldLabel"
      :placeholder="fieldPlaceholder"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
      @update:model-value="updateDatetime"
    />

    <!-- date -->
    <FormDate
      v-else-if="resolvedType === 'date'"
      :model-value="dateModel()"
      :label="fieldLabel"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
      @update:model-value="updateDate"
    />

    <!-- enum -->
    <FormSelect
      v-else-if="resolvedType === 'enum'"
      v-model="selectValue"
      :label="fieldLabel"
      :placeholder="`Select ${fieldLabel}…`"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
      :options="selectOptions"
    />

    <!-- ref -->
    <FormSearchSelect
      v-else-if="resolvedType === 'ref'"
      v-model="singleRefValue"
      :label="fieldLabel"
      :placeholder="asyncLoading ? 'Loading…' : `Select ${fieldLabel}…`"
      :required="field.required"
      :disabled="field.readOnly || asyncLoading"
      :error="error"
      :options="asyncOptions"
    />

    <!-- select-async legacy -->
    <FormSearchSelect
      v-else-if="resolvedType === 'select-async'"
      v-model="singleRefValue"
      :label="fieldLabel"
      :placeholder="asyncLoading ? 'Loading…' : `Select ${fieldLabel}…`"
      :required="field.required"
      :disabled="field.readOnly || asyncLoading"
      :error="error"
      :options="asyncOptions"
    />

    <!-- file -->
    <FormFile
      v-else-if="resolvedType === 'file'"
      :model-value="(modelValue as File | null)"
      :label="fieldLabel"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
      @update:model-value="updateFile"
    />

    <!-- many-to-many -->
    <FormMultipleSelect
      v-else-if="resolvedType === 'many-to-many'"
      :model-value="manyModel()"
      :label="fieldLabel"
      :placeholder="`Select ${fieldLabel}…`"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
      :options="asyncOptions.length ? asyncOptions : selectOptions"
      @update:model-value="updateMany"
    />

    <!-- computed (read-only) -->
    <div v-else-if="resolvedType === 'computed'" class="form-control w-full">
      <label class="label">
        <span class="label-text font-semibold">
          {{ fieldLabel }}
          <span v-if="field.required" class="text-error ml-1">*</span>
        </span>
      </label>
      <div class="input input-bordered w-full flex items-center bg-base-200 text-base-content">
        {{ computedValue }}
      </div>
    </div>

    <!-- fallback string -->
    <FormInput
      v-else
      v-model="stringValue"
      type="text"
      :label="fieldLabel"
      :placeholder="fieldPlaceholder"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
    />
  </div>
</template>
