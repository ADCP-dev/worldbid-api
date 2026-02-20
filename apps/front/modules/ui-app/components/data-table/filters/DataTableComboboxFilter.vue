<script setup lang="ts">
import { ref, computed } from 'vue'
import { Check, ChevronsUpDown } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface FilterOption {
  value: string | number | boolean
  label: string
}

const props = defineProps<{
  modelValue: string | number | boolean | null | undefined
  options: FilterOption[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean | null | undefined]
}>()

const open = ref(false)
const searchTerm = ref('')

const selectedLabel = computed(() => {
  if (!props.modelValue && props.modelValue !== 0) return ''
  const found = props.options.find(o => String(o.value) === String(props.modelValue))
  return found?.label || ''
})

const filteredOptions = computed(() => {
  if (!searchTerm.value) return props.options
  const term = searchTerm.value.toLowerCase()
  return props.options.filter(o => o.label.toLowerCase().includes(term))
})

function selectOption(option: FilterOption) {
  // If selecting the same value or the "all" option (empty value), clear the filter
  if (String(option.value) === String(props.modelValue) || option.value === '') {
    emit('update:modelValue', '')
  } else {
    emit('update:modelValue', option.value)
  }
  open.value = false
  searchTerm.value = ''
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        class="w-full justify-between h-9 text-sm font-normal"
        :class="{ 'text-muted-foreground': !modelValue }"
      >
        <span class="truncate">{{ selectedLabel || placeholder || 'Filtrar...' }}</span>
        <ChevronsUpDown class="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[200px] p-0" align="start">
      <div class="flex items-center border-b px-3">
        <input
          v-model="searchTerm"
          class="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          :placeholder="placeholder || 'Buscar...'"
        />
      </div>
      <div class="max-h-[200px] overflow-y-auto p-1">
        <div
          v-if="filteredOptions.length === 0"
          class="py-6 text-center text-sm text-muted-foreground"
        >
          Sin resultados.
        </div>
        <button
          v-for="option in filteredOptions"
          :key="String(option.value)"
          class="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          @click="selectOption(option)"
        >
          <Check
            :class="cn('mr-2 h-4 w-4', String(modelValue) === String(option.value) ? 'opacity-100' : 'opacity-0')"
          />
          <span class="truncate">{{ option.label }}</span>
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>
