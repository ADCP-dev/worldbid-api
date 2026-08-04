<script setup lang="ts">
/* spec-engine-v2-frontend-and-loader (Slice 6): edit form route.
 *
 * `/app/{resource}/{id}/edit` renders SpecDataForm in `edit` mode. This
 * is the destination of the Edit button on SpecDetail. Pre-change the
 * `{id}` route rendered the form directly; with Slice 6 the read-only
 * detail view lives at `{id}` and the form at `{id}/edit`.
 *
 * Nuxt static-segment priority: `[id]/edit.vue` matches
 * `/app/tasks/123/edit` while `[id].vue` matches `/app/tasks/123`.
 */
const route = useRoute()
const resource = computed(() => String(route.params.resource))
const id = computed(() => String(route.params.id))
</script>

<template>
  <div class="container mx-auto px-4 py-6">
    <SpecDataForm :id="id" :resource="resource" mode="edit" />
  </div>
</template>