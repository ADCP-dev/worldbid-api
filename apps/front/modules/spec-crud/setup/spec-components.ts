/**
 * spec-components — registry of custom Vue components referenced by name
 * from `PanelSpec.component` and `ViewSpec.component` in spec metadata.
 *
 * The dashboard resolves string names against this map. Unresolved names
 * render an inline error block in the panel area instead of crashing the
 * whole view (per design: "visible error, not a crash").
 *
 * ## Registration
 *
 * The map lives in a Nuxt-layer auto-imported module (`setup/`). Nuxt scans
 * `setup/` via the `imports.dirs` config in `nuxt.config.ts` and exposes the
 * exports as auto-imports. SpecDashboard imports `specComponents` directly via
 * the relative path (explicit is clearer for a registry than an auto-import
 * for type inference), but the file is part of the layer so it is bundled.
 *
 * ## Code-splitting
 *
 * Each entry uses `defineAsyncComponent` so a custom panel's code only loads
 * when the dashboard that references it is rendered. For dashboards that use
 * only the built-in chart types (stat/donut/bar/line), no custom chunk loads.
 *
 * ## Adding a custom component
 *
 * ```ts
 * import MyCustomPanel from '../components/MyCustomPanel.vue'
 * specComponents['MyCustomPanel'] = defineAsyncComponent(() => import('../components/MyCustomPanel.vue'))
 * ```
 *
 * spec-engine-v2-frontend-and-loader (Slice 5): created.
 */
import { defineAsyncComponent } from 'vue'
import type { Component } from 'vue'

/**
 * The registry. Keys are the string names that appear in
 * `PanelSpec.component` / `ViewSpec.component`. Values are async Vue
 * components.
 *
 * The map starts empty — Foundation does not ship any built-in custom
 * dashboard components. Extensions and downstream apps add their own entries
 * by importing this map and assigning, or by re-declaring it in their own
 * layer `setup/` file (Nuxt layer precedence applies).
 *
 * Re-declaration is preferred for downstream apps; direct mutation is
 * supported for the common case where an extension registers a single
 * component at boot.
 */
export const specComponents: Record<string, Component> = {
  // Built-in custom components would be registered here, e.g.:
  // MyCustomPanel: defineAsyncComponent(() => import('../components/MyCustomPanel.vue')),
}

/**
 * Resolve a component name to a Vue component, or `null` if not registered.
 *
 * Returns `null` (not `undefined`) so callers can distinguish "not found"
 * from "falsy component" in template `v-if` checks without ambiguity.
 */
export function resolveSpecComponent(name: string): Component | null {
  return specComponents[name] ?? null
}

/**
 * Register a custom component by name. Useful for extensions that want to
 * add a single component without re-declaring the whole map.
 */
export function registerSpecComponent(name: string, loader: () => Promise<Component>): void {
  specComponents[name] = defineAsyncComponent(loader)
}

// Re-export defineAsyncComponent so registrants don't need a separate vue
// import when adding entries imperatively.
export { defineAsyncComponent }