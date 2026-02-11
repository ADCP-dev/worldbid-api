<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import Label from "~/components/ui/label/Label.vue";
import { Search, X, PlusCircle } from "lucide-vue-next";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const props = defineProps<{
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  description?: string;
  options?: Array<{ label: string; value: string | number }>;
  // Props for create button
  showCreateButton?: boolean;
  createButtonText?: string;
  createButtonIcon?: boolean;
  onCreateClick?: () => void;
}>();

const model = defineModel<string | number>();

// Search functionality
const search = ref("");
const searchInput = ref<HTMLInputElement | null>(null);

// Filter options based on search text
const filteredOptions = computed(() => {
  if (!search.value) return props.options;
  
  return props.options?.filter(option => 
    option.label.toLowerCase().includes(search.value.toLowerCase())
  );
});

// Clear search when dropdown closes
const clearSearch = () => {
  search.value = "";
};

// Keep focus on search input when typing
const onSearchFocus = () => {
  // Use nextTick to ensure focus after Vue updates the DOM
  nextTick(() => {
    searchInput.value?.focus();
  });
};

// Function to handle when an option is selected
const handleSelection = () => {
  // Reset search after selection
  search.value = "";
};
</script>

<template>
  <div class="relative space-y-2">
    <Label
      >{{ label }}<span v-if="required" class="text-red-600">*</span></Label
    >
    <Select
      v-model="model"
      :placeholder="placeholder"
      :disabled="disabled"
      @update:model-value="handleSelection"
    >
      <SelectTrigger class="w-full" :class="{ 'border-destructive': error }">
        <SelectValue :placeholder="placeholder" />
      </SelectTrigger>
      
      <SelectContent @hidden="clearSearch">
        <!-- Search field at the top of dropdown -->
        <div class="px-2 py-2 sticky top-0 bg-popover border-b border-border">
          <div class="relative">
            <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              ref="searchInput"
              v-model="search"
              class="w-full h-9 py-2 pl-8 pr-2 rounded-md bg-transparent border border-input focus:outline-none focus:ring-1 focus:ring-ring focus:border-input"
              placeholder="Buscar..."
              @click.stop
              @keydown.stop
              @focus="onSearchFocus"
            >
            <button 
              v-if="search" 
              class="absolute right-2 top-2.5"
              @click="search = ''"
            >
              <X class="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <!-- Display all options filtered by search -->
        <div class="max-h-[300px] overflow-auto">
          <SelectItem 
            v-for="option in filteredOptions" 
            :key="option.value" 
            :value="option.value"
          >
            {{ option.label }}
          </SelectItem>
          
          <!-- No results message -->
          <div v-if="filteredOptions?.length === 0" class="px-2 py-4 text-sm text-center text-muted-foreground">
            No hay resultados
          </div>
          
          <!-- Create button at the bottom (conditional) -->
          <div 
            v-if="showCreateButton" 
            class="px-2 py-2 sticky bottom-0 border-t border-border bg-popover mt-1"
          >
            <button
              type="button"
              class="flex w-full items-center justify-center py-1.5 px-2 text-sm rounded-md bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
              @click.stop="onCreateClick && onCreateClick()"
            >
              <PlusCircle v-if="createButtonIcon" class="mr-2 h-4 w-4" />
              {{ createButtonText || 'Crear nuevo' }}
            </button>
          </div>
        </div>
      </SelectContent>
    </Select>
    
    <p v-if="description" class="text-xs text-muted-foreground">
      {{ description }}
    </p>
    
    <p v-if="error" class="text-sm text-destructive">
      {{ error }}
    </p>
  </div>
</template>
