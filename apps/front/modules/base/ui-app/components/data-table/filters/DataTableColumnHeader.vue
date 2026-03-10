<script setup lang="ts">
import { ArrowUpDown } from 'lucide-vue-next'

defineProps<{
  column: any
  title: string
}>()
</script>

<template>
  <button
    @click="column.toggleSorting(column.getIsSorted() === 'asc')"
    class="btn btn-ghost btn-xs -ml-4 h-8"
  >
    <span>{{ title }}</span>
    <ArrowUpDown class="ml-2 h-4 w-4" />
  </button>
</template>
