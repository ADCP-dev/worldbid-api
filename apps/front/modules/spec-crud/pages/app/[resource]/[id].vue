<script setup lang="ts">
const route = useRoute()
const resource = computed(() => String(route.params.resource))
const id = computed(() => String(route.params.id))
</script>

<template>
  <div class="container mx-auto px-4 py-6">
    <SpecDataForm :id="id" :resource="resource" mode="edit" />
  </div>
</template>