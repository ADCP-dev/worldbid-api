import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { type FieldSpec, type ResourceSpec, refResource, refLabelField } from './useSpecResource'

/* ------------------------------------------------------------------ *
 * useRefResolver — batch-loads related records for `ref` fields and
 * caches them so the UI can render avatars / links instead of raw FKs.
 *
 * The backend returns ref fields as raw integer IDs (e.g.
 * `task.assigneeId = 1`), NOT joined objects. To render "Super Admin"
 * or an avatar we must fetch the related records client-side. This
 * composable:
 *   1. Scans a list of field specs for `ref` fields.
 *   2. Collects the distinct FK ids per (resource, fieldName) pair.
 *   3. Loads each referenced resource once (cached), then indexes by id.
 *   4. Exposes `resolveRef(resource, id)` → the full record, and
 *      `resolveRefDisplay(resource, id, labelField)` → a display string.
 *
 * Caching is in-memory per composable instance (component-scoped). A
 * module-level cache would leak across navigations; per-instance keeps
 * it simple and correct for the component lifespan.
 * ------------------------------------------------------------------ */

/** A resolved ref record, loosely typed (the shape depends on the resource). */
export type RefRecord = Record<string, unknown>

export interface RefDisplay {
  /** The label string (e.g. "Super Admin" or "Design database schema"). */
  label: string
  /** Sub-label (e.g. email) for tooltips / secondary text. */
  subLabel?: string
  /** Avatar image URL when the referenced record has a photo. */
  avatarUrl?: string
  /** Initials for the avatar placeholder. */
  initials?: string
  /** The full record (for advanced rendering). */
  record?: RefRecord
}

/**
 * Per-resource record cache: `resource -> { id -> record }`.
 * MODULE-LEVEL so all `useRefResolver()` instances share the same cache.
 * This is essential because `SpecFieldRenderer` calls `useRefResolver()`
 * per instance — without a shared cache, each renderer would have its
 * own empty cache and never see the records loaded by the parent.
 * Reactive so consumers re-render when records load.
 */
const sharedCache = ref<Record<string, Record<string, RefRecord>>>({})
const sharedLoaded = ref<Set<string>>(new Set())
const sharedLoading = ref<Set<string>>(new Set())

export function useRefResolver() {
  const specCrud = useSpecResource()

  /** Expose the shared cache for reactive reads. */
  const cache = sharedCache

  /** Track which resources have been (or are being) loaded to avoid duplicate fetches. */
  const loadedResources = sharedLoaded
  const loadingResources = sharedLoading

  /**
   * Load (once per resource per composable instance) ALL records of a
   * referenced resource, up to a generous limit, then index by id.
   * We load all because we don't have a generic "fetch by ids[]" endpoint;
   * the list endpoint is the cheapest path and the limit is large enough
   * for typical ref targets (users, tasks).
   */
  async function ensureResourceLoaded(resource: string): Promise<void> {
    if (loadedResources.value.has(resource) || loadingResources.value.has(resource)) {
      // Already loaded or in-flight. Wait for the in-flight load by polling
      // the loading set (simple, no external promise bookkeeping needed).
      if (loadingResources.value.has(resource)) {
        await new Promise<void>((resolve) => {
          const check = () => {
            if (!loadingResources.value.has(resource)) resolve()
            else setTimeout(check, 50)
          }
          check()
        })
      }
      return
    }
    const inflight = new Set(loadingResources.value)
    inflight.add(resource)
    loadingResources.value = inflight
    try {
      let rows: RefRecord[] = []
      // The ref resource name may not be in the spec registry (e.g. "user"
      // is referenced by tasks but has no spec entry). endpointFor() falls
      // back to the singular name, but the real endpoint is often plural
      // (e.g. /users). Try the spec endpoint first, then pluralize.
      // Also guard against the backend returning an HTML shell (304/200
      // from a catch-all route) — $fetch may not throw on those.
      const candidates = [resource, resource + 's']
      for (const cand of candidates) {
        try {
          const res = await specCrud.list<RefRecord>(cand, { limit: 200 })
          // Validate the response is actually a list payload, not an HTML
          // shell or error object. An empty list is valid; a non-array
          // `data` (or missing `data`) means this candidate is wrong.
          if (res && Array.isArray((res as { data?: unknown }).data)) {
            rows = (res as { data: RefRecord[] }).data
            break
          }
        } catch {
          // try next candidate
        }
      }
      const byId: Record<string, RefRecord> = {}
      for (const row of rows) {
        const id = row.id ?? row[specPrimaryKey(resource)]
        if (id !== undefined && id !== null) byId[String(id)] = row
      }
      cache.value = { ...cache.value, [resource]: byId }
      loadedResources.value = new Set(loadedResources.value).add(resource)
    } catch {
      // Failed to load ref resource — leave cache empty; resolveRef returns null.
    } finally {
      const next = new Set(loadingResources.value)
      next.delete(resource)
      loadingResources.value = next
    }
  }

  /** Best-effort primary key name for a resource from the spec registry. */
  function specPrimaryKey(resource: string): string {
    const spec = specCrud.resources.value[resource]
    return spec?.primaryKey ?? 'id'
  }

  /**
   * Load every ref resource referenced by the given field specs. Call this
   * once per component (e.g. in `watchEffect` or `onMounted`) so the cache
   * is warm before render. Safe to call repeatedly — already-loaded
   * resources are skipped.
   */
  async function preloadRefs(fields: FieldSpec[]): Promise<void> {
    const refResources = new Set<string>()
    for (const f of fields) {
      const r = refResource(f)
      if (r) refResources.add(r)
    }
    await Promise.all([...refResources].map((r) => ensureResourceLoaded(r)))
  }

  /**
   * Resolve a single ref id to its full record. Returns undefined when
   * not yet loaded or not found. Reactive — re-renders when the cache
   * for that resource populates.
   */
  function resolveRef(resource: string, id: string | number | null | undefined): RefRecord | undefined {
    if (id === null || id === undefined || id === '') return undefined
    const map = cache.value[resource]
    if (!map) return undefined
    return map[String(id)]
  }

  /**
   * Resolve a ref id to a display object (label, subLabel, avatarUrl,
   * initials). Falls back gracefully when the record isn't loaded:
   *   - returns `{ label: '#<id>' }` so the UI shows "#1" instead of
   *     the raw "userId: 1".
   *
   * `labelField` defaults to the field's declared `ref.labelField`,
   * then 'name', then 'title', then 'firstName', then 'id'.
   */
  function resolveRefDisplay(
    resource: string,
    id: string | number | null | undefined,
    labelField?: string,
  ): RefDisplay {
    const rec = resolveRef(resource, id)
    if (!rec) {
      return id === null || id === undefined || id === ''
        ? { label: '—' }
        : { label: `#${id}` }
    }
    const field = labelField ?? pickLabelField(rec)
    const primary = rec[field]
    const label = primary === null || primary === undefined ? `#${id}` : String(primary)

    // Avatar URL: try common photo fields.
    const avatarUrl = (rec.avatar ?? rec.photo ?? rec.avatarUrl ?? rec.profileImage) as
      | string
      | null
      | undefined

    // Sub-label: prefer email, then a secondary name field.
    const subLabel = (rec.email ?? rec.lastName ?? rec.username) as string | undefined

    // Initials from the label (first letters of up to 2 words).
    const initials = makeInitials(label)

    return { label, subLabel, avatarUrl: avatarUrl ?? undefined, initials, record: rec }
  }

  function pickLabelField(rec: RefRecord): string {
    for (const candidate of ['name', 'title', 'firstName', 'username', 'label', 'id']) {
      if (rec[candidate] !== null && rec[candidate] !== undefined) return candidate
    }
    return 'id'
  }

  function makeInitials(label: string): string {
    if (!label) return '?'
    const parts = label.trim().split(/\s+/)
    return parts
      .map((p) => p.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2)
  }

  /**
   * Convenience: returns a computed that resolves a ref field for a row.
   * Usage: `const assignee = resolveRefComputed(() => 'user', () => row.assigneeId, 'firstName')`
   */
  function resolveRefComputed(
    resource: string | (() => string | undefined),
    id: Ref<string | number | null | undefined> | ComputedRef<string | number | null | undefined> | (() => string | number | null | undefined),
    labelField?: string,
  ): ComputedRef<RefDisplay> {
    const resGetter: () => string | undefined =
      typeof resource === 'function' ? resource : () => resource
    const idGetter: () => string | number | null | undefined =
      typeof id === 'function' ? id : () => id.value
    return computed(() => {
      const r = resGetter()
      if (!r) return { label: '—' }
      return resolveRefDisplay(r, idGetter(), labelField)
    })
  }

  /**
   * Enrich a list of rows by attaching a `_refs` map: `_refs[fieldName]`
   * holds the resolved ref record (or undefined). The renderer can then
   * read `row._refs.assigneeId` to show an avatar/label without each
   * cell re-resolving. Returns a new array (does not mutate input).
   */
  function enrichRows(
    rows: Array<Record<string, unknown>>,
    fields: FieldSpec[],
  ): Array<Record<string, unknown>> {
    return rows.map((row) => {
      const refs: Record<string, RefRecord | undefined> = {}
      for (const f of fields) {
        const r = refResource(f)
        if (!r) continue
        const id = row[f.name]
        if (id === null || id === undefined || id === '') continue
        refs[f.name] = resolveRef(r, id as string | number)
      }
      return { ...row, _refs: refs }
    })
  }

  return {
    cache,
    preloadRefs,
    ensureResourceLoaded,
    resolveRef,
    resolveRefDisplay,
    resolveRefComputed,
    enrichRows,
  }
}