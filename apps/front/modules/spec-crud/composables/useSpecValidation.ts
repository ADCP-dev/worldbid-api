/**
 * useSpecValidation — frontend Zod parity builder.
 *
 * ## Parity contract
 *
 * The backend `ValidationFactory`
 * (apps/back/src/core/spec-engine/validation-factory.ts) is the AUTHORITATIVE
 * source of truth for request-body validation. This composable mirrors the
 * same `FieldValidationSpec` rules (min / max / pattern / email / url) on the
 * client so the UI can give immediate feedback BEFORE the round-trip. The
 * backend always re-validates; the frontend schema is UX-only and MUST NEVER
 * be treated as a security boundary.
 *
 * ## Drift surface
 *
 * Both builders read the same `FieldValidationSpec` shape, so a new rule added
 * on the backend needs to be mirrored here (and vice-versa). The fields
 * mirrored today are exactly the ones in `FieldValidationSpec`:
 *   - `min`  (number for integer/decimal, string length for string/text/enum)
 *   - `max`  (number for integer/decimal, string length for string/text/enum)
 *   - `pattern` (regex string applied to string-like fields)
 *   - `email` (boolean → z.string().email())
 *   - `url`   (boolean → z.string().url())
 *
 * Field types mirrored from the backend `FieldType` union:
 *   string, text, integer, decimal, boolean, datetime, date, json, enum, ref,
 *   file, computed, password, secret, many-to-many.
 *
 * Any field type not in the explicit switch falls back to `z.unknown()` — the
 * backend will reject it if invalid. This matches the backend's `default`
 * branch in `buildFieldSchema`.
 *
 * ## Required vs optional
 *
 * Mirrors the backend create schema: required fields are enforced; optional
 * fields are `.optional()`. Empty-string on required string-like fields is
 * rejected via a refine (matches the pre-change SpecDataForm behavior so
 * backward compat holds when no `FieldValidationSpec` is present).
 *
 * ## Usage
 *
 *   import { buildZodSchema } from './useSpecValidation'
 *   const schema = buildZodSchema(fields)
 *   const result = schema.safeParse(formState)
 *
 * Pure function — no Vue ref, no side effects. Lives in a composable file for
 * Nuxt auto-import, but `buildZodSchema` itself is a plain export.
 */
import { z } from 'zod'
import type { FieldSpec } from './useSpecResource'

/**
 * Mirror of backend `FieldValidationSpec`. Kept here (and re-exported) so
 * consumers don't need to cross workspace boundaries. The backend
 * `spec.types.ts` is the authoritative definition; this is the frontend
 * projection. If the backend adds a new field, mirror it here AND in
 * `buildFieldSchema` below.
 */
export interface FieldValidationSpec {
  min?: number
  max?: number
  pattern?: string
  email?: boolean
  url?: boolean
}

/**
 * Augment `FieldSpec` with the `validation` field used by the parity builder.
 * The base `FieldSpec` in `useSpecResource.ts` is intentionally loose; this
 * local interface adds the validation contract without forcing a breaking
 * change on the base type. Both shapes are structurally compatible.
 */
export type ValidatedFieldSpec = FieldSpec & { validation?: FieldValidationSpec }

/**
 * Build a single field's Zod schema, mirroring the backend `buildFieldSchema`.
 * Returns `z.unknown()` for unhandled types (same as backend default branch).
 */
function buildFieldSchema(field: ValidatedFieldSpec): z.ZodTypeAny {
  const v = field.validation
  let schema: z.ZodTypeAny

  switch (field.type) {
    case 'string':
    case 'text':
    case 'password':
    case 'secret':
      schema = z.string()
      if (v?.min !== undefined) schema = (schema as z.ZodString).min(v.min)
      if (v?.max !== undefined) schema = (schema as z.ZodString).max(v.max)
      if (v?.pattern) schema = (schema as z.ZodString).regex(new RegExp(v.pattern))
      if (v?.email) schema = (schema as z.ZodString).email()
      if (v?.url) schema = (schema as z.ZodString).url()
      break

    case 'enum':
      // When enum values are declared, use z.enum for literal validation;
      // otherwise fall back to a plain string (backend default branch).
      if (field.enum && field.enum.length) {
        schema = z.enum(field.enum as [string, ...string[]])
      } else {
        schema = z.string()
      }
      if (v?.min !== undefined) schema = (schema as z.ZodString).min(v.min)
      if (v?.max !== undefined) schema = (schema as z.ZodString).max(v.max)
      if (v?.pattern) schema = (schema as z.ZodString).regex(new RegExp(v.pattern))
      break

    case 'integer':
      schema = z.coerce.number().int()
      if (v?.min !== undefined) schema = (schema as z.ZodNumber).min(v.min)
      if (v?.max !== undefined) schema = (schema as z.ZodNumber).max(v.max)
      break

    case 'decimal':
    case 'float':
    case 'number':
      schema = z.coerce.number()
      if (v?.min !== undefined) schema = (schema as z.ZodNumber).min(v.min)
      if (v?.max !== undefined) schema = (schema as z.ZodNumber).max(v.max)
      break

    case 'boolean':
      schema = z.boolean()
      break

    case 'datetime':
    case 'timestamp':
      // Frontend keeps datetime as ISO string (datetime-local input). Backend
      // uses z.coerce.date(); we keep the string form for form-state fidelity
      // and let the backend coerce. Pattern/min/max don't apply.
      schema = z.string()
      break

    case 'date':
      schema = z.string()
      break

    case 'json':
      // Zod 4 requires both key and value schemas: z.record(keySchema, valueSchema).
      // Backend (Zod 3) uses z.record(z.unknown()); here we mirror with string keys.
      schema = z.record(z.string(), z.unknown())
      break

    case 'ref':
      // Refs are positive integer FKs on the backend. On the frontend the
      // value can be a string (select-async) or a number; we accept both and
      // let the backend narrow. Required-ness is applied by the caller.
      schema = z.union([z.number().int().positive(), z.string().min(1)])
      break

    case 'many-to-many':
      schema = z.array(z.union([z.number().int().positive(), z.string().min(1)]))
      break

    case 'file':
      // File fields hold either a staged File instance or a previously
      // uploaded URL string. The backend expects a UUID string; on the
      // frontend we accept File | string and let useSpecSubmit resolve to a
      // URL before the request leaves the browser.
      schema = z.union([z.string(), z.instanceof(File)])
      break

    case 'computed':
      // Computed fields are read-only; accept anything (backend fills them).
      schema = z.unknown()
      break

    default:
      schema = z.unknown()
  }

  return schema
}

/**
 * Apply required/optional semantics to a field schema, mirroring the backend
 * create schema. Boolean/number fields skip the empty-string refine (it
 * doesn't apply to them); string-like required fields reject empty strings.
 */
function applyRequired(
  field: ValidatedFieldSpec,
  schema: z.ZodTypeAny,
): z.ZodTypeAny {
  if (!field.required) return schema.optional()

  // Boolean and numeric types: required = present (not undefined). No
  // empty-string refine needed.
  if (
    field.type === 'boolean' ||
    field.type === 'integer' ||
    field.type === 'decimal' ||
    field.type === 'float' ||
    field.type === 'number'
  ) {
    return schema
  }

  // String-like and ref/file types: reject empty string AND null AND
  // undefined. This matches the pre-change SpecDataForm behavior so backward
  // compat holds when no FieldValidationSpec is set.
  return schema.refine(
    (val) => val !== '' && val !== undefined && val !== null,
    { message: 'Required' },
  )
}

/**
 * Build a `z.ZodObject` from a list of field specs. Read-only fields are
 * excluded (they are not part of the submitted payload). Mirrors the backend
 * `buildSchema(spec, isCreate=true)` shape.
 *
 * @param fields Field specs to include in the schema.
 * @returns A `ZodObject` keyed by field name. Use `.safeParse(formState)` to
 *   validate; collect issues into a `Record<string, string>` for display.
 */
export function buildZodSchema(
  fields: ValidatedFieldSpec[],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of fields) {
    if (field.readOnly) continue
    const fieldSchema = buildFieldSchema(field)
    shape[field.name] = applyRequired(field, fieldSchema)
  }
  return z.object(shape)
}

/**
 * Build a schema for a SUBSET of fields (used by `useSpecStepper` for
 * per-step validation). Only the named fields are included; missing names are
 * silently skipped (a typo in the step spec shouldn't crash the form).
 *
 * @param fields Full field list (to look up by name).
 * @param names Field names to include in the subset schema.
 * @returns A `ZodObject` for the subset.
 */
export function buildZodSchemaSubset(
  fields: ValidatedFieldSpec[],
  names: string[],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const byName = new Map(fields.map((f) => [f.name, f]))
  const subset: ValidatedFieldSpec[] = []
  for (const name of names) {
    const f = byName.get(name)
    if (f) subset.push(f)
  }
  return buildZodSchema(subset)
}

/**
 * Collect Zod issues into a `Record<string, string>` keyed by field name.
 * The first issue per field wins (matches the pre-change SpecDataForm
 * behavior). Paths deeper than one level are flattened to the top-level key.
 */
export function collectZodErrors(
  issues: z.ZodIssue[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '')
    if (!key) continue
    if (!out[key]) out[key] = issue.message
  }
  return out
}