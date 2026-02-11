<script setup lang="ts">
import { defineProps } from 'vue'
import { Button } from '@/components/ui/button'
import { ArrowUpDown } from 'lucide-vue-next'

const props = defineProps<{
  column: any,
  label: string
}>()
</script>

<template>
  <Button
    variant="ghost"
    @click="() => props.column.toggleSorting(props.column.getIsSorted() === 'asc')"
  >
    {{ props.label }}
    <ArrowUpDown class="ml-2 h-4 w-4" />
  </Button>
</template>
