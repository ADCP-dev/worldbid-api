<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import type { FieldSpec } from '../composables/useSpecResource'

const props = defineProps<{
  /** v-model value */
  modelValue: unknown
  /** Field spec with UI hints */
  field: FieldSpec
  /** Resource name — needed for select-async to load ref options */
  resource?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
}>()

const ui = computed(() => props.field.ui ?? {})
const formInput = computed(() => ui.value.formInput ?? 'text')

const internalValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const inputId = computed(() => `spec-field-${props.field.name}`)

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
    console.error('[SpecFieldInput] Failed to load ref options:', e)
    asyncOptions.value = []
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
function handleFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) emit('update:modelValue', file)
}
</script>

<template>
  <div class="form-control w-full">
    <label class="label" :for="inputId">
      <span class="label-text">
        {{ field.label ?? field.name }}
        <span v-if="field.required" class="text-error">*</span>
      </span>
    </label>

    <!-- text -->
    <input
      v-if="formInput === 'text'"
      :id="inputId"
      v-model="internalValue"
      type="text"
      class="input input-bordered w-full"
      :placeholder="field.label ?? field.name"
      :disabled="field.readOnly"
    />

    <!-- textarea -->
    <textarea
      v-else-if="formInput === 'textarea'"
      :id="inputId"
      v-model="internalValue"
      class="textarea textarea-bordered w-full"
      rows="4"
      :placeholder="field.label ?? field.name"
      :disabled="field.readOnly"
    />

    <!-- select (enum) -->
    <select
      v-else-if="formInput === 'select'"
      :id="inputId"
      v-model="internalValue"
      class="select select-bordered w-full"
      :disabled="field.readOnly"
    >
      <option :value="undefined" disabled>
        Select {{ field.label ?? field.name }}…
      </option>
      <option v-for="opt in field.enum ?? []" :key="String(opt)" :value="opt">
        {{ opt }}
      </option>
    </select>

    <!-- datepicker -->
    <input
      v-else-if="formInput === 'datepicker'"
      :id="inputId"
      v-model="internalValue"
      type="datetime-local"
      class="input input-bordered w-full"
      :disabled="field.readOnly"
    />

    <!-- file-upload -->
    <input
      v-else-if="formInput === 'file-upload'"
      :id="inputId"
      type="file"
      class="file-input file-input-bordered w-full"
      :disabled="field.readOnly"
      @change="handleFile"
    />

    <!-- select-async (ref) -->
    <select
      v-else-if="formInput === 'select-async'"
      :id="inputId"
      v-model="internalValue"
      class="select select-bordered w-full"
      :disabled="field.readOnly || asyncLoading"
    >
      <option :value="undefined" disabled>
        {{ asyncLoading ? 'Loading…' : `Select ${field.label ?? field.name}…` }}
      </option>
      <option v-for="opt in asyncOptions" :key="String(opt.value)" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>

    <!-- fallback: text -->
    <input
      v-else
      :id="inputId"
      v-model="internalValue"
      type="text"
      class="input input-bordered w-full"
      :placeholder="field.label ?? field.name"
      :disabled="field.readOnly"
    />
  </div>
</template>