<script setup lang="ts">
const route = useRoute()
const resource = computed(() => String(route.params.resource))
</script>

<template>
  <div class="container mx-auto px-4 py-6">
    <SpecDataTable :resource="resource" />
  </div>
</template>