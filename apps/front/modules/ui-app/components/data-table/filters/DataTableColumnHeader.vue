<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { ArrowUpDown } from 'lucide-vue-next'

defineProps<{
  column: any
  title: string
}>()
</script>

<template>
  <Button
    variant="ghost"
    @click="column.toggleSorting(column.getIsSorted() === 'asc')"
    class="-ml-4 h-8 data-[state=open]:bg-accent"
  >
    <span>{{ title }}</span>
    <ArrowUpDown class="ml-2 h-4 w-4" />
  </Button>
</template>
