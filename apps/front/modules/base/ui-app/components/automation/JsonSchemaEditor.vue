<script setup lang="ts">
/**
 * JsonSchemaEditor — editor de JSON estructurado guiado por ZodSchema.
 *
 * Subset soportado (Q-008): z.object (recursivo), z.string, z.number,
 * z.boolean, z.array(z.object()), z.enum, z.optional, z.nullable.
 * NO soportado (v1): discriminatedUnion, intersection, transform, preprocess.
 */
import { computed, ref, watch } from 'vue'
import type { ZodSchema } from 'zod'
import JsonSchemaField from '@base/ui-app/components/automation/JsonSchemaField.vue'

const props = defineProps<{
  modelValue: Record<string, unknown>
  schema: ZodSchema
  label?: string
  disabled?: boolean
  collapsed?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, unknown>): void
}>()

interface ZodDefInfo {
  type: string
  shape?: Record<string, ZodSchema>
  innerType?: ZodSchema
  element?: ZodSchema
  values?: readonly string[]
}

function inspect(schema: ZodSchema): ZodDefInfo | null {
  const def = (schema as { _zod?: { def: ZodDefInfo } })._zod?.def
    ?? (schema as { _def?: ZodDefInfo })._def
  if (!def) return null
  return def as ZodDefInfo
}

const info = computed<ZodDefInfo | null>(() => inspect(props.schema))
const shape = computed<Record<string, ZodSchema>>(() => info.value?.shape ?? {})

const local = ref<Record<string, unknown>>({ ...props.modelValue })
const errors = ref<Record<string, string>>({})
const collapsedState = ref(props.collapsed ?? false)

watch(() => props.modelValue, (v) => { local.value = { ...v } }, { deep: true })

function validate(): boolean {
  errors.value = {}
  const r = props.schema.safeParse(local.value)
  if (r.success) return true
  const issues = (r as { error?: { issues: Array<{ path: (string | number)[]; message: string }> } }).error?.issues ?? []
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '_')
    if (!errors.value[key]) errors.value[key] = issue.message
  }
  return false
}

function emitIfValid() {
  if (validate()) emit('update:modelValue', { ...local.value })
}

function updateField(key: string, value: unknown) {
  local.value = { ...local.value, [key]: value }
  emitIfValid()
}
</script>

<template>
  <div class="form-control w-full space-y-3">
    <div v-if="label" class="flex items-center justify-between">
      <span class="font-semibold">{{ label }}</span>
      <button
        v-if="info?.shape"
        type="button"
        class="btn btn-ghost btn-xs"
        @click="collapsedState = !collapsedState"
      >
        {{ collapsedState ? $t('mod.ui.automation.expand') : $t('mod.ui.automation.collapse') }}
      </button>
    </div>

    <div v-show="!collapsedState" class="space-y-3">
      <template v-if="info?.shape">
        <JsonSchemaField
          v-for="(fieldSchema, key) in shape"
          :key="key"
          :model-value="local[key as string]"
          :schema="fieldSchema"
          :label="key as string"
          :disabled="disabled"
          :error="errors[key as string]"
          @update:model-value="updateField(key as string, $event)"
        />
      </template>

      <!-- Schema raíz no es object: fallback al campo individual -->
      <JsonSchemaField
        v-else
        :model-value="local"
        :schema="schema"
        :label="label"
        :disabled="disabled"
        @update:model-value="local = $event as Record<string, unknown>"
      />
    </div>
  </div>
</template>