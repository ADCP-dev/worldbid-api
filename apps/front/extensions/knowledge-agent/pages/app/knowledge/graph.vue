<script setup lang="ts">
import KnowledgeGraph from '@ka/components/KnowledgeGraph.vue';

definePageMeta({
  layout: 'default',
  title: 'Knowledge Graph',
});
</script>

<template>
  <div class="h-[calc(100vh-64px)] -m-4">
    <KnowledgeGraph />
  </div>
</template>