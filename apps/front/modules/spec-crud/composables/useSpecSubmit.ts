/**
 * useSpecSubmit — submits a spec-engine form payload, handling file fields.
 *
 * ## Open Question Q1 — Resolution (recorded in apply-progress #8)
 *
 * The design (sdd/spec-engine-v2-frontend-and-loader/design, decision
 * "FormData multipart detection") proposed: scan payload for `File`/`File[]`
 * and build a `multipart/form-data` request with JSON-string non-file parts.
 *
 * Verification during this slice (task 2.3) found that the **spec-engine
 * `controller-factory.ts` does NOT register a `FileInterceptor`** — only
 * hand-written extension controllers do (cms/media, cms/blog/posts, storage,
 * users). The change restriction forbids touching `controller-factory.ts`.
 * So a spec-engine CRUD endpoint (POST /api/v1/<resource>) would NOT parse a
 * multipart body; the design's "always-multipart when file present" branch
 * would break the backend.
 *
 * **Decision**: conservador fallback (the design explicitly listed this as a
 * valid fallback). Files are uploaded via the EXISTING `POST /files/upload`
 * endpoint (handled by `FilesLocalController`/`FilesS3Controller` which DO
 * have `FileInterceptor`). That endpoint returns `FileResponseDto` with a
 * `file.path` URL string. We store that URL string in the field value and
 * submit the rest as JSON (`application/json`), unchanged from pre-change
 * behavior for non-file fields.
 *
 * This requires ZERO backend changes (no `controller-factory` edit), reuses
 * the existing `useFileUpload` composable (auto-imported by Nuxt), and keeps
 * the spec-engine submit contract simple: `Record<string, unknown>` JSON.
 *
 * If a future change adds `FileInterceptor` to spec-engine controllers, the
 * "build a single multipart FormData" branch from the design can be restored
 * here without touching consumers — `submit()` keeps the same signature.
 */
import { ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import type { FieldSpec } from './useSpecResource'
import { useSpecResource } from './useSpecResource'

/** Shape returned by POST /files/upload (FileResponseDto). */
interface FileUploadResponse {
  file: { path: string; id: string; name: string; [k: string]: unknown }
}

/**
 * `true` when the value carries at least one `File` instance. A previously
 * submitted value (string URL) is NOT a File, so it is left untouched — this
 * makes the function idempotent across save/edit cycles.
 */
function isFileValue(value: unknown): value is File | File[] {
  if (value instanceof File) return true
  if (Array.isArray(value) && value.length > 0 && value[0] instanceof File) return true
  return false
}

/** Field metadata that influences upload behavior (mime filter, multi-flag). */
function fileMetaFromField(field: FieldSpec): { multiple: boolean; accept?: string } {
  const ui = field.ui ?? {}
  return {
    multiple: Boolean(ui.multiple),
    accept: ui.accept,
  }
}

/**
 * Upload a single staged file to `/files/upload`, returning the persisted URL
 * path. `useFileUpload` is auto-imported by the storage Nuxt layer
 * (apps/front/modules/base/storage/nuxt.config.ts → imports.dirs). We rely on
 * that auto-import; no explicit import path is needed (and `@base/storage` is
 * not exposed as a TS path alias).
 */
async function uploadOne(file: File, resource: string, fieldName: string): Promise<string> {
  const meta = {
    entityName: resource,
    context: fieldName,
    isPublic: true,
  }
  // `useFileUpload` is a Nuxt auto-import (see .nuxt/types/imports.d.ts).
  const uploadMutation = useFileUpload()
  const result = await uploadMutation.mutateAsync({ file, meta })
  const res = result as FileUploadResponse
  if (!res?.file?.path) {
    throw new Error(`Upload succeeded but response is missing file.path for ${fieldName}`)
  }
  return res.file.path
}

/**
 * Walk the payload, replacing every staged `File`/`File[]` with the URL string
 * returned by `/files/upload`. Non-file values (including previously submitted
 * URL strings) pass through unchanged. Uploads run sequentially to keep
 * server-side ordering deterministic and avoid request bursts.
 */
async function resolveFileFields(
  payload: Record<string, unknown>,
  fields: FieldSpec[],
  resource: string,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...payload }
  for (const field of fields) {
    const value = out[field.name]
    if (!isFileValue(value)) continue
    const { multiple, accept } = fileMetaFromField(field)
    // accept is honoured by the <input type="file" :accept> on the client; the
    // server-side filter is FieldSpec.allowedMimes (already enforced there).
    void accept
    if (multiple && Array.isArray(value)) {
      const paths: string[] = []
      for (const f of value) {
        paths.push(await uploadOne(f, resource, field.name))
      }
      out[field.name] = paths
    } else if (value instanceof File) {
      // Single-file case. We deliberately do NOT combine the multiple=true +
      // single-File case here: if the field declares `multiple` but the user
      // picked one file, a single URL string is still the correct payload.
      out[field.name] = await uploadOne(value, resource, field.name)
    }
  }
  return out
}

/** Fields that can carry files (type `file` OR ui.formInput `file-upload`). */
function fileFields(fields: FieldSpec[]): FieldSpec[] {
  return fields.filter((f) => {
    if (f.type === 'file') return true
    const fi = f.ui?.formInput
    return fi === 'file-upload'
  })
}

/**
 * Submits a spec-engine form payload for create or update.
 *
 * Behavior:
 *  - If the payload contains staged `File` values for file fields, they are
 *    uploaded to `/files/upload` first; the persisted URL strings replace the
 *    File instances, and the resulting JSON body is sent with
 *    `application/json` (default `$fetch` behavior — we do NOT set
 *    Content-Type manually).
 *  - If no file fields are present, the payload is sent unchanged as JSON.
 *    This is byte-identical to the pre-change submit path (backward compat).
 *  - Already-submitted URL strings (edit mode) are left untouched, so re-
 *    saving a record without re-selecting a file does NOT re-upload.
 */
export function useSpecSubmit(resource: () => string) {
  const specCrud = useSpecResource()
  const queryClient = useQueryClient()
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function submit(
    payload: Record<string, unknown>,
    mode: 'create' | 'edit',
    id?: string | number,
  ): Promise<Record<string, unknown> | undefined> {
    saving.value = true
    error.value = null
    try {
      const resourceName = resource()
      const spec = specCrud.getResource(resourceName).value
      const fields = spec?.fields ?? []
      const fFields = fileFields(fields)

      let body: Record<string, unknown> = payload
      if (fFields.length > 0) {
        // Only walk file fields when the resource declares at least one —
        // avoids the per-field `isFileValue` scan for non-file resources.
        body = await resolveFileFields(payload, fFields, resourceName)
      }

      let result: Record<string, unknown> | undefined
      if (mode === 'create') {
        result = await specCrud.create<Record<string, unknown>>(resourceName, body)
        toast.success('Created successfully')
      } else if (mode === 'edit' && id !== undefined) {
        result = await specCrud.update<Record<string, unknown>>(resourceName, id, body)
        toast.success('Updated successfully')
      } else {
        throw new Error('useSpecSubmit: edit mode requires an id')
      }

      // Invalidate list/findOne caches so the table/detail reflect the change.
      queryClient.invalidateQueries({ queryKey: ['spec', resourceName, 'list'] })
      queryClient.invalidateQueries({ queryKey: ['spec', resourceName, 'findOne'] })
      return result
    } catch (e) {
      const err = e as { data?: { message?: string | string[] } }
      const msg = err?.data?.message
      error.value = Array.isArray(msg) ? msg.join(', ') : msg ?? 'An error occurred while saving.'
      throw e
    } finally {
      saving.value = false
    }
  }

  return { saving, error, submit }
}