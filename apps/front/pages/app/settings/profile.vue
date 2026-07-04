<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});
</script>

<template>
  <SettingsLayout>
    <SettingsProfileForm />
  </SettingsLayout>
</template>

<style scoped>

</style>
