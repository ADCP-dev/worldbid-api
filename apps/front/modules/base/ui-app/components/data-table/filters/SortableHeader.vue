<script setup lang="ts">
import { ArrowUpDown } from 'lucide-vue-next'

const props = defineProps<{
  column: any,
  label: string
}>()
</script>

<template>
  <button
    class="btn btn-ghost btn-sm"
    @click="() => props.column.toggleSorting(props.column.getIsSorted() === 'asc')"
  >
    {{ props.label }}
    <ArrowUpDown class="ml-2 h-4 w-4" />
  </button>
</template>
