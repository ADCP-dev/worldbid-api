<script setup lang="ts">
import { ref, computed, nextTick, useSlots } from "vue";
import { Search, X, PlusCircle, ChevronDown } from "lucide-vue-next";

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
const slots = useSlots();

// Search functionality
const search = ref("");
const searchInput = ref<HTMLInputElement | null>(null);
const isOpen = ref(false);

const selectedLabel = computed(() => {
  const option = props.options?.find(opt => opt.value === model.value);
  return option ? option.label : props.placeholder || "Seleccionar...";
});

// Filter options based on search text
const filteredOptions = computed(() => {
  if (!search.value) return props.options;

  return props.options?.filter(option =>
    option.label.toLowerCase().includes(search.value.toLowerCase())
  );
});

function toggleDropdown() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    nextTick(() => {
      searchInput.value?.focus();
    });
  }
}

function selectOption(value: string | number) {
  model.value = value;
  isOpen.value = false;
  search.value = "";
}

function clearSearch() {
  search.value = "";
  searchInput.value?.focus();
}

function handleClickOutside(event: MouseEvent) {
  if (!(event.target as HTMLElement).closest(".dropdown")) {
    isOpen.value = false;
  }
}

watch(isOpen, (val) => {
  if (val) {
    document.addEventListener("click", handleClickOutside);
  } else {
    document.removeEventListener("click", handleClickOutside);
    search.value = "";
  }
});
</script>

<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text font-semibold">
        {{ label }}<span v-if="required" class="text-error ml-1">*</span>
      </span>
    </label>

    <div class="dropdown w-full" :class="{ 'dropdown-open': isOpen }">
      <div
        tabindex="0"
        role="button"
        class="select select-bordered w-full flex items-center justify-between"
        :class="{ 'select-error': error, 'select-disabled cursor-not-allowed': disabled }"
        @click="toggleDropdown"
      >
        <span class="truncate">{{ selectedLabel }}</span>
        <ChevronDown class="h-4 w-4 opacity-50" />
      </div>

      <div
        v-if="isOpen"
        class="dropdown-content z-20 menu p-2 shadow-xl bg-base-100 rounded-box w-full border  mt-1"
      >
        <!-- Search field at the top of dropdown -->
        <div class="p-1 mb-2">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
            <input
              ref="searchInput"
              v-model="search"
              class="input input-sm input-bordered w-full pl-9 pr-8"
              placeholder="Buscar..."
              @click.stop
              @keydown.stop
            >
            <button
              v-if="search"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
              @click.stop="clearSearch"
            >
              <X class="h-3 w-3" />
            </button>
          </div>
        </div>

        <!-- Display all options filtered by search -->
        <ul class="max-h-60 overflow-y-auto w-full">
          <li v-for="option in filteredOptions" :key="option.value">
            <button
              type="button"
              class="w-full text-left"
              :class="{ 'active': model === option.value }"
              @click="selectOption(option.value)"
            >
              {{ option.label }}
            </button>
          </li>

          <!-- No results message -->
          <li v-if="filteredOptions?.length === 0" class="disabled italic p-2 text-center opacity-50 text-sm">
            No hay resultados
          </li>
        </ul>

        <!-- Create button at the bottom (conditional) -->
        <div v-if="showCreateButton" class="border-t  mt-2 p-1 pt-2">
          <button
            type="button"
            class="btn btn-primary btn-sm w-full"
            @click.stop="onCreateClick && onCreateClick(); isOpen = false"
          >
            <PlusCircle v-if="createButtonIcon" class="h-4 w-4" />
            {{ createButtonText || 'Crear nuevo' }}
          </button>
        </div>
      </div>
    </div>

    <label v-if="description" class="label py-1">
      <span class="label-text-alt text-base-content/60">{{ description }}</span>
    </label>

    <label v-if="error" class="label py-0">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>
