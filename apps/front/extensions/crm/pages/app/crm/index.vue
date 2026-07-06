<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});
</script>

<template>
  <div class="p-6">
    <CrmDashboard />
  </div>
</template>