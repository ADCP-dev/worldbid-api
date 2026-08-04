/**
 * useSpecActions — partition and run custom actions declared in
 * `spec.actions[]`.
 *
 * Backend context (apps/back/src/core/spec-engine/spec-engine-action-factory.ts):
 * Each action is mounted at `/api/v1/{pluralizedResource}/{action.path}`.
 * Row actions have `:id` in the path; bulk/header actions do not. The
 * `ActionSpec.handler` field is internal to the backend (a require()'d
 * function); the frontend always calls the HTTP endpoint.
 *
 * Partition by `ui.buttonLocation`:
 *   - 'row'    → row action menu (rendered per-row alongside Edit/Delete)
 *   - 'bulk'   → bulk toolbar (visible only when selection.length > 0)
 *   - 'header' → toolbar buttons (always visible)
 *
 * spec-engine-v2-frontend-and-loader (Slice 4, task 4.1).
 *
 * Row-click vs action-click disambiguation is handled in SpecDataTable via
 * `event.target.closest('[data-action]')` — the table does NOT navigate when
 * the click originated inside an element marked with `data-action`.
 */
import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { ActionSpec, ResourceSpec } from './useSpecResource'

export type ButtonLocation = 'row' | 'bulk' | 'header'

export interface ResolvedAction {
  /** Original action spec. */
  spec: ActionSpec
  /** Resolved button location (default 'header'). */
  location: ButtonLocation
  /** Display label (action.ui.label or capitalized name). */
  label: string
  /** Icon name from action.ui.icon (resolved by the template). */
  icon?: string
  /** Confirm dialog message, if any. */
  confirm?: string
}

/**
 * Partition `spec.actions[]` by `ui.buttonLocation`.
 *
 * Actions without a `ui` block or without `buttonLocation` default to
 * `'header'` (always-visible toolbar button) — the least surprising
 * placement for a custom action that doesn't declare where to render.
 */
export function useSpecActions(spec: ComputedRef<ResourceSpec | undefined>) {
  const actions = computed<ResolvedAction[]>(() => {
    const raw = spec.value?.actions
    if (!raw || !raw.length) return []
    return raw.map((a) => {
      const location: ButtonLocation = a.ui?.buttonLocation ?? 'header'
      const label = a.ui?.label ?? capitalize(a.name)
      return {
        spec: a,
        location,
        label,
        icon: a.ui?.icon,
        confirm: a.ui?.confirm,
      }
    })
  })

  const rowActions = computed<ResolvedAction[]>(() =>
    actions.value.filter((a) => a.location === 'row'),
  )

  const bulkActions = computed<ResolvedAction[]>(() =>
    actions.value.filter((a) => a.location === 'bulk'),
  )

  const headerActions = computed<ResolvedAction[]>(() =>
    actions.value.filter((a) => a.location === 'header'),
  )

  const hasActions = computed<boolean>(() => actions.value.length > 0)

  return {
    /** All resolved actions. */
    actions,
    /** Actions rendered per-row (alongside Edit/Delete). */
    rowActions,
    /** Actions rendered in the bulk toolbar (visible only with selection). */
    bulkActions,
    /** Actions rendered in the header toolbar (always visible). */
    headerActions,
    /** Whether the resource declares any custom actions. */
    hasActions,
  }
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}