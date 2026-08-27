<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
  title: 'Chat',
});
</script>

<template>
  <AgentChatLayout />
</template>
