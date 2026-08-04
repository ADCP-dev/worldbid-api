<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import type { FieldSpec } from '../composables/useSpecResource'
import FormInput from '@base/ui-app/components/form/FormInput.vue'
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue'
import FormSelect from '@base/ui-app/components/form/FormSelect.vue'
import FormSearchSelect from '@base/ui-app/components/form/FormSearchSelect.vue'
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue'
import FormFile from '@base/ui-app/components/form/FormFile.vue'
import FormMultipleFile from '@base/ui-app/components/form/FormMultipleFile.vue'
import FormMultipleSelect from '@base/ui-app/components/form/FormMultipleSelect.vue'
import FormDate from '@base/ui-app/components/form/FormDate.vue'
import FormTime from '@base/ui-app/components/form/FormTime.vue'
import FormPassword from '@base/ui-app/components/form/FormPassword.vue'
import KeyValueEditor from '@base/ui-app/components/form/KeyValueEditor.vue'
import NumericStepper from '@base/ui-app/components/form/NumericStepper.vue'
import ToggleGroup from '@base/ui-app/components/form/ToggleGroup.vue'
import WeekdayPicker from '@base/ui-app/components/form/WeekdayPicker.vue'
import TimeWindowPicker from '@base/ui-app/components/form/TimeWindowPicker.vue'
import type { ToggleOption } from '@base/ui-app/components/automation/types'
import type { TimeWindow } from '@base/ui-app/components/scheduling/types'
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

/* ---------- help text (ui.helpText hint, rendered under any input) ---------- */
const helpText = computed(() => ui.value.helpText)

/* ---------- field type mapping ----------
 * Priority:
 *   1. ui.formInput wins when it picks a non-default renderer
 *      (toggle-group, stepper, time, time-window, weekday-picker, switch,
 *       radio, file-upload, select-async, datepicker, textarea, select)
 *   2. else field.type picks the renderer (legacy + new types)
 *
 * New types added by spec-engine-v2 (Slice 2):
 *   - json → KeyValueEditor
 *   - password / secret → FormPassword
 *   - time (datetime alias with ui.formInput='time') → FormTime
 *   - file + ui.multiple=true → FormMultipleFile
 *   - integer + ui.formInput='stepper' → NumericStepper
 *   - enum + ui.formInput='toggle-group' → ToggleGroup (with icons)
 *   - integer + ui.formInput='weekday-picker' → WeekdayPicker
 *   - integer + ui.formInput='time-window' → TimeWindowPicker
 *
 * The 12 pre-change types remain intact (backward compat): a field that
 * does not set a new formInput value nor a new type still resolves exactly
 * as before.
 */
const resolvedType = computed(() => {
  const explicit = formInput.value
  // ── explicit ui.formInput dispatch (highest priority) ──
  if (explicit === 'select-async') return 'select-async'
  if (explicit === 'file-upload') return 'file'
  if (explicit === 'datepicker') return 'datetime'
  if (explicit === 'textarea') return 'text'
  if (explicit === 'select') return 'enum'
  if (explicit === 'time') return 'time'
  if (explicit === 'toggle-group') return 'toggle-group'
  if (explicit === 'stepper') return 'stepper'
  if (explicit === 'weekday-picker') return 'weekday-picker'
  if (explicit === 'time-window') return 'time-window'
  if (explicit === 'switch') return 'boolean'
  if (explicit === 'radio') return 'enum'

  // ── field.type dispatch ──
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
  // ── new types (Slice 2) ──
  if (backendType === 'json') return 'json'
  if (backendType === 'password' || backendType === 'secret') return 'password'
  return 'string'
})

const fieldLabel = computed(() => props.field.label ?? props.field.name)
const fieldPlaceholder = computed(() => ui.value.placeholder ?? props.field.label ?? props.field.name)

const selectValue = computed({
  get: () => props.modelValue as string | number | undefined,
  set: (val) => emitValue(val === undefined ? undefined : val),
})

const singleRefValue = computed({
  get: () => props.modelValue as string | number | undefined,
  set: (val) => emitValue(val === undefined ? undefined : val),
})

/* ---------- json / KeyValueEditor binding ---------- */
const jsonValue = computed<Record<string, unknown>>({
  get: () => {
    const v = props.modelValue
    if (v == null) return {}
    if (typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
    // tolerate primitive defaults: wrap as empty
    return {}
  },
  set: (val) => emitValue(val),
})

/* ---------- NumericStepper binding ---------- */
const stepperValue = computed<number>({
  get: () => numberModel() ?? 0,
  set: (val) => emitValue(val),
})

/* ---------- ToggleGroup binding (single-value enum mode) ---------- */
const toggleGroupOptions = computed<ToggleOption[]>(() => {
  return (props.field.enum ?? []).map((opt) => {
    const label = String(opt)
    return { value: label, label }
  })
})

const toggleGroupValue = computed<string>({
  get: () => (props.modelValue == null ? '' : String(props.modelValue)),
  set: (val) => emitValue(val || undefined),
})

/* ---------- WeekdayPicker binding (integer[] of ISO day numbers) ---------- */
const weekdayValue = computed<number[]>({
  get: () => {
    const v = props.modelValue
    if (Array.isArray(v)) return v.filter((x): x is number => typeof x === 'number')
    return []
  },
  set: (val) => emitValue(val),
})

/* ---------- TimeWindowPicker binding ({start,end,timezone}) ---------- */
const timeWindowValue = computed<TimeWindow>({
  get: () => {
    const v = props.modelValue
    if (v && typeof v === 'object' && 'start' in v && 'end' in v) {
      const obj = v as { start: string; end: string; timezone?: string }
      return { start: obj.start, end: obj.end, timezone: obj.timezone ?? 'UTC' }
    }
    return { start: '09:00', end: '17:00', timezone: 'UTC' }
  },
  set: (val) => emitValue(val),
})

/* ---------- FormTime binding (HH:mm string) ---------- */
const timeValue = computed<string>({
  get: () => (props.modelValue == null ? '' : String(props.modelValue)),
  set: (val) => emitValue(val || undefined),
})

/* ---------- FormMultipleFile binding (File[]) ---------- */
const multipleFileValue = computed<File[] | null>({
  get: () => {
    const v = props.modelValue
    if (Array.isArray(v)) return v as File[]
    return null
  },
  set: (val) => emitValue(val ?? []),
})

/* Unknown formInput warning — names the offending value so authors can fix
 * the spec instead of silently rendering a text fallback. Resolved at
 * evaluation time so it only logs once per value change. */
watch(
  () => formInput.value,
  (val) => {
    const known: Array<string | undefined> = [
      'text',
      'textarea',
      'select',
      'datepicker',
      'file-upload',
      'select-async',
      'time',
      'toggle-group',
      'stepper',
      'radio',
      'switch',
      'weekday-picker',
      'time-window',
      undefined,
    ]
    if (!known.includes(val)) {
      console.warn(
        `[SpecFieldInput] Unknown ui.formInput "${val}" on field "${props.field.name}" — falling back to text input.`,
      )
    }
  },
  { immediate: true },
)
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
      :description="helpText"
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
      :description="helpText"
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
      :description="helpText"
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
      :description="helpText"
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
      :description="helpText"
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
      :description="helpText"
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
      :description="helpText"
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
      :placeholder="fieldPlaceholder"
      :description="helpText"
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
      :placeholder="asyncLoading ? 'Loading…' : fieldPlaceholder"
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
      :placeholder="asyncLoading ? 'Loading…' : fieldPlaceholder"
      :required="field.required"
      :disabled="field.readOnly || asyncLoading"
      :error="error"
      :options="asyncOptions"
    />

    <!-- file (single) -->
    <FormFile
      v-else-if="resolvedType === 'file' && !ui.multiple"
      :model-value="(modelValue as File | null)"
      :label="fieldLabel"
      :description="helpText"
      :accept="ui.accept"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
      @update:model-value="updateFile"
    />

    <!-- file (multiple) — ui.multiple=true -->
    <FormMultipleFile
      v-else-if="resolvedType === 'file' && ui.multiple"
      v-model="multipleFileValue"
      :label="fieldLabel"
      :description="helpText"
      :accept="ui.accept"
      :disabled="field.readOnly"
      :error="error"
    />

    <!-- many-to-many -->
    <FormMultipleSelect
      v-else-if="resolvedType === 'many-to-many'"
      :model-value="manyModel()"
      :label="fieldLabel"
      :placeholder="fieldPlaceholder"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
      :options="asyncOptions.length ? asyncOptions : selectOptions"
      @update:model-value="updateMany"
    />

    <!-- ── New: json → KeyValueEditor ── -->
    <KeyValueEditor
      v-else-if="resolvedType === 'json'"
      v-model="jsonValue"
      :label="fieldLabel"
      :disabled="field.readOnly"
    />
    <p v-if="helpText && resolvedType === 'json'" class="text-xs text-base-content/60 mt-1">
      {{ helpText }}
    </p>

    <!-- ── New: password / secret → FormPassword ── -->
    <FormPassword
      v-else-if="resolvedType === 'password'"
      v-model="stringValue"
      :label="fieldLabel"
      :placeholder="fieldPlaceholder"
      :description="helpText"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
    />

    <!-- ── New: time (ui.formInput='time') → FormTime ── -->
    <FormTime
      v-else-if="resolvedType === 'time'"
      v-model="timeValue"
      :label="fieldLabel"
      :placeholder="fieldPlaceholder"
      :description="helpText"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
    />

    <!-- ── New: integer + ui.formInput='stepper' → NumericStepper ── -->
    <NumericStepper
      v-else-if="resolvedType === 'stepper'"
      v-model="stepperValue"
      :label="fieldLabel"
      :description="helpText"
      :min="field.validation?.min"
      :max="field.validation?.max"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
    />

    <!-- ── New: enum + ui.formInput='toggle-group' → ToggleGroup ──
         Icons not derivable from a plain enum; spec authors who want icons
         can extend FieldUiHints.options in a follow-up. Single-select mode
         so it behaves like a radio group. -->
    <ToggleGroup
      v-else-if="resolvedType === 'toggle-group'"
      v-model="toggleGroupValue"
      :options="toggleGroupOptions"
      :multiple="false"
      :label="fieldLabel"
      :disabled="field.readOnly"
      :error="error"
    />
    <p v-if="helpText && resolvedType === 'toggle-group'" class="text-xs text-base-content/60 mt-1">
      {{ helpText }}
    </p>

    <!-- ── New: integer + ui.formInput='weekday-picker' → WeekdayPicker ──
         Stores ISO day numbers (0=Sun..6=Sat) as integer[]. -->
    <WeekdayPicker
      v-else-if="resolvedType === 'weekday-picker'"
      v-model="weekdayValue"
      :label="fieldLabel"
      :disabled="field.readOnly"
    />
    <p v-if="helpText && resolvedType === 'weekday-picker'" class="text-xs text-base-content/60 mt-1">
      {{ helpText }}
    </p>

    <!-- ── New: integer + ui.formInput='time-window' → TimeWindowPicker ──
         Stores {start: 'HH:mm', end: 'HH:mm', timezone: 'UTC'} object. -->
    <TimeWindowPicker
      v-else-if="resolvedType === 'time-window'"
      v-model="timeWindowValue"
      :label="fieldLabel"
      :disabled="field.readOnly"
      :error="error"
    />
    <p v-if="helpText && resolvedType === 'time-window'" class="text-xs text-base-content/60 mt-1">
      {{ helpText }}
    </p>

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
      :description="helpText"
      :required="field.required"
      :disabled="field.readOnly"
      :error="error"
    />
  </div>
</template>
