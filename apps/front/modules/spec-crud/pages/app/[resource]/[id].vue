<script setup lang="ts">
/* spec-engine-v2-frontend-and-loader (Slice 6): detail view.
 *
 * `/app/{resource}/{id}` now renders the read-only SpecDetail component
 * instead of the edit form directly. The edit form lives at
 * `/app/{resource}/{id}/edit` (see `[id]/edit.vue`), reached via the
 * Edit button on the detail page. Nuxt routes static segments ahead of
 * dynamic ones, so `[id].vue` matches `/app/tasks/123` while
 * `[id]/edit.vue` matches `/app/tasks/123/edit`.
 */
const route = useRoute()
const resource = computed(() => String(route.params.resource))
const id = computed(() => String(route.params.id))
</script>

<template>
  <SpecDetail :id="id" :resource="resource" />
</template>