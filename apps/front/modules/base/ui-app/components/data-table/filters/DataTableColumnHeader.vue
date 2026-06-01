<script setup lang="ts">
import { ArrowUpDown } from 'lucide-vue-next'

defineProps<{
  column: any
  title: string
}>()
</script>

<template>
  <button
    class="btn btn-ghost btn-xs -ml-4 h-8"
    @click="column.toggleSorting(column.getIsSorted() === 'asc')"
  >
    <span>{{ title }}</span>
    <ArrowUpDown class="ml-2 h-4 w-4" />
  </button>
</template>
