import type { Component } from 'vue'
import type { ZodSchema } from 'zod'

export interface RadioCardOption {
  value: string
  label: string
  icon?: Component
  description?: string
}

export interface ToggleOption {
  value: string
  label: string
  icon?: Component
  description?: string
}

export interface FieldRelationConfig {
  field: string
  endpoint: string
  map: (item: unknown) => unknown
}

export interface JsonSchemaEditorProps {
  modelValue: Record<string, unknown>
  schema: ZodSchema
  label?: string
  disabled?: boolean
  collapsed?: boolean
}

/**
 * Zod subset soportado por JsonSchemaEditor (Q-008):
 *  - z.object (recursivo)
 *  - z.string, z.number, z.boolean
 *  - z.array(z.object())
 *  - z.enum
 *  - z.optional, z.nullable (desenvuelve tipo interno)
 * NO soportado (v1): z.discriminatedUnion, z.intersection,
 *  z.transform, z.preprocess, z.refine con effects.
 */
export type ZodDef = {
  type?: string
  shape?: Record<string, ZodSchema>
  innerType?: ZodSchema
  element?: ZodSchema
  values?: readonly string[]
}