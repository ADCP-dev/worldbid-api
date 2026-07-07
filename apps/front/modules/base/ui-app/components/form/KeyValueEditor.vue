<script setup lang="ts">
/**
 * KeyValueEditor — lista de pares clave-valor editables con add/remove.
 * Soporta valueType: string | number | boolean (renderiza input/switch según tipo).
 * keyPattern valida claves contra regex.
 */
import { computed, ref, watch } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import FormInput from '@base/ui-app/components/form/FormInput.vue'
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue'

const props = defineProps<{
  modelValue: Record<string, unknown>
  label?: string
  valueType?: 'string' | 'number' | 'boolean'
  keyPattern?: string
  disabled?: boolean
  maxRows?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, unknown>): void
}>()

type Row = { key: string; value: unknown }

const rows = ref<Row[]>([])
const invalidKeys = ref<Set<number>>(new Set())

function fromRecord(rec: Record<string, unknown>): Row[] {
  return Object.entries(rec).map(([key, value]) => ({ key, value }))
}

function toRecord(list: Row[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const r of list) {
    if (r.key.trim() === '') continue
    out[r.key] = r.value
  }
  return out
}

watch(() => props.modelValue, (v) => {
  rows.value = fromRecord(v ?? {})
}, { immediate: true })

const vType = computed(() => props.valueType ?? 'string')
const canAddRow = computed(() => {
  if (props.disabled) return false
  if (props.maxRows && rows.value.length >= props.maxRows) return false
  return true
})

function validateKey(idx: number, key: string) {
  if (!props.keyPattern) {
    invalidKeys.value.delete(idx)
    return
  }
  const re = new RegExp(props.keyPattern)
  if (re.test(key)) invalidKeys.value.delete(idx)
  else invalidKeys.value.add(idx)
}

function updateRow(idx: number, patch: Partial<Row>) {
  rows.value = rows.value.map((r, i) => (i === idx ? { ...r, ...patch } : r))
  if (patch.key !== undefined) validateKey(idx, patch.key)
  emit('update:modelValue', toRecord(rows.value))
}

function addRow() {
  if (!canAddRow.value) return
  const emptyVal: unknown = vType.value === 'boolean' ? false : vType.value === 'number' ? 0 : ''
  rows.value = [...rows.value, { key: '', value: emptyVal }]
  emit('update:modelValue', toRecord(rows.value))
}

function removeRow(idx: number) {
  rows.value = rows.value.filter((_, i) => i !== idx)
  invalidKeys.value.delete(idx)
  emit('update:modelValue', toRecord(rows.value))
}
</script>

<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text font-semibold">{{ label }}</span>
    </label>

    <div class="space-y-2">
      <div
        v-for="(row, idx) in rows"
        :key="idx"
        class="flex items-end gap-2"
      >
        <div class="flex-1">
          <FormInput
            :model-value="row.key"
            label=""
            placeholder="key"
            :disabled="disabled"
            :error="invalidKeys.has(idx) ? $t('base-ui.automation.invalidKey') : undefined"
            @update:model-value="updateRow(idx, { key: $event as string })"
          />
        </div>

        <div class="flex-1">
          <FormSwitch
            v-if="vType === 'boolean'"
            :model-value="Boolean(row.value)"
            label=""
            :disabled="disabled"
            @update:model-value="updateRow(idx, { value: $event })"
          />
          <FormInput
            v-else
            :model-value="row.value as string | number"
            label=""
            placeholder="value"
            :type="vType === 'number' ? 'number' : 'text'"
            :disabled="disabled"
            @update:model-value="updateRow(idx, { value: vType === 'number' ? Number($event) : $event })"
          />
        </div>

        <button
          type="button"
          class="btn btn-ghost btn-sm text-error"
          :disabled="disabled"
          :aria-label="$t('base-ui.automation.removeRow')"
          @click="removeRow(idx)"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        class="btn btn-sm btn-outline gap-2"
        :disabled="!canAddRow"
        @click="addRow"
      >
        <Plus class="h-4 w-4" />
        {{ $t('base-ui.automation.addRow') }}
      </button>
    </div>
  </div>
</template>