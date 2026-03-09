<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["auth"],
});
</script>

<template>
  <ErrorTrackerErrorDashboard />
</template>
