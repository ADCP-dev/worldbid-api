<script setup lang="ts">
/* spec-engine-v2-frontend-and-loader (Slice 6): view switching.
 *
 * Reads `ResourceUISpec.view` from the MetaController payload and renders
 * the matching view component:
 *   - 'kanban' → SpecKanban
 *   - 'list'   → SpecList
 *   - 'table' / undefined → SpecDataTable (default, pre-change behavior)
 *
 * The spec is loaded via `useSpecResource.getResource`, which is a
 * TanStack Query backed by GET /api/v1/_spec/resources. While the spec
 * is loading or the resource is unknown, we render a spinner and a
 * visible "not found" error block respectively. The component also
 * re-evaluates when the route param changes (navigating between two
 * resources keeps the same page mounted).
 */
const route = useRoute()
const resource = computed(() => String(route.params.resource))

const specCrud = useSpecResource()
const spec = specCrud.getResource(resource.value)
const view = computed(() => spec.value?.ui?.view ?? 'table')
</script>

<template>
  <div class="container mx-auto px-4 py-6">
    <!-- Spec loading -->
    <div
      v-if="!specCrud.resources.value[resource] && Object.keys(specCrud.resources.value).length === 0"
      class="flex justify-center py-12"
    >
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <!-- Unknown resource (visible error, not a crash) -->
    <div
      v-else-if="!specCrud.resources.value[resource]"
      class="alert alert-error"
    >
      <span>
        Resource "{{ resource }}" is not registered. Check the spec files
        loaded by the spec engine.
      </span>
    </div>

    <!-- View switch -->
    <SpecKanban
      v-else-if="view === 'kanban'"
      :resource="resource"
    />
    <SpecList
      v-else-if="view === 'list'"
      :resource="resource"
    />
    <SpecDataTable
      v-else
      :resource="resource"
    />
  </div>
</template>