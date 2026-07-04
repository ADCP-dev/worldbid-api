<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ['auth', 'admin'],
});
</script>

<template>
  <ErrorTrackerErrorDashboard />
</template>
