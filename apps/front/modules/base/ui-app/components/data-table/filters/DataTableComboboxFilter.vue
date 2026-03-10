<script setup lang="ts">
import { ref, computed } from 'vue'
import { Check, ChevronsUpDown } from 'lucide-vue-next'

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
  <div class="dropdown" :class="{ 'dropdown-open': open }">
    <button
      role="combobox"
      class="btn btn-outline btn-sm w-full font-normal justify-between"
      :class="{ 'opacity-70': !modelValue }"
      @click="open = !open"
    >
      <span class="truncate">{{ selectedLabel || placeholder || 'Filtrar...' }}</span>
      <ChevronsUpDown class="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
    </button>
    <ul class="dropdown-content z-[10] menu p-2 shadow bg-base-100 rounded-box w-52 mt-1">
      <li class="p-0 mb-2 border-b border-base-300 pb-2">
        <input
          v-model="searchTerm"
          class="input input-sm input-ghost w-full"
          :placeholder="placeholder || 'Buscar...'"
        />
      </li>
      <div class="max-h-[200px] overflow-y-auto">
        <li v-if="filteredOptions.length === 0" class="disabled">
          <span class="py-2 text-center text-sm opacity-50 justify-center">Sin resultados.</span>
        </li>
        <li v-for="option in filteredOptions" :key="String(option.value)">
          <a @click="selectOption(option)" class="flex items-center gap-2">
            <Check :class="String(modelValue) === String(option.value) ? 'opacity-100' : 'opacity-0'" class="h-4 w-4" />
            <span class="truncate flex-1">{{ option.label }}</span>
          </a>
        </li>
      </div>
    </ul>

    <!-- Background overlay to catch outside clicks and close the dropdown -->
    <div v-if="open" class="fixed inset-0 z-[9] cursor-default" @click.stop="open = false"></div>
  </div>
</template>
