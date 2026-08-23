<script setup lang="ts">
/**
 * FieldRelation — FormSearchSelect que, al seleccionar, dispara fetch
 * a `endpoint` para auto-fill de otros campos y emite `select` con item completo.
 * Usa useApi() (maneja refresh 401). Errores → toast vue-sonner, no rompe form.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import FormSearchSelect from '@base/ui-app/components/form/FormSearchSelect.vue'
import type { FieldRelationConfig } from './types'

const props = defineProps<{
  modelValue: string | number
  label: string
  endpoint: string
  options?: Array<{ label: string; value: string | number }>
  relations?: FieldRelationConfig[]
  error?: string
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'select', item: unknown): void
}>()

const model = defineModel<string | number>({ required: true })
const loading = ref(false)
const { t: $t } = useI18n()

function findSelected(value: string | number): unknown {
  return props.options?.find((o) => o.value === value) ?? null
}

async function fetchAndEmit(value: string | number) {
  // Emit select con item completo si encontramos match local
  const local = findSelected(value)
  if (local) emit('select', local)

  if (!props.relations || props.relations.length === 0) return
  if (!value) return

  loading.value = true
  const api = useApi()
  try {
    const item = await api.get<unknown>(`${props.endpoint}/${value}`)
    emit('select', item)
  } catch (err) {
    const status = (err as { status?: number }).status
    if (status === 404) {
      toast.error($t('mod.ui.automation.relationNotFound'))
    } else {
      toast.error($t('mod.ui.automation.relationError'))
    }
  } finally {
    loading.value = false
  }
}

function onSelect(value: string | number) {
  model.value = value
  emit('update:modelValue', value)
  fetchAndEmit(value)
}
</script>

<template>
  <div class="form-control w-full">
    <FormSearchSelect
      :model-value="model"
      :label="label"
      :options="options"
      :error="error"
      :disabled="disabled || loading"
      :placeholder="placeholder"
      @update:model-value="onSelect($event as string | number)"
    />
    <span v-if="loading" class="loading loading-spinner loading-xs text-primary mt-1" />
  </div>
</template>