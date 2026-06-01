<script setup lang="ts">
import { ref, computed, nextTick, useSlots, watch } from "vue";
import { Search, X, PlusCircle, ChevronDown, SearchIcon } from "lucide-vue-next";
import { onKeyStroke, onClickOutside } from "@vueuse/core";

const props = defineProps<{
  label: string;
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

const search = ref("");
const searchInput = ref<HTMLInputElement | null>(null);
const isOpen = ref(false);
const activeIndex = ref(-1);
const dropdownRef = ref<HTMLElement | null>(null);

const selectedLabel = computed(() => {
  const option = props.options?.find(opt => opt.value === model.value);
  return option ? option.label : props.placeholder || "Seleccionar...";
});

const filteredOptions = computed(() => {
  if (!search.value) return props.options || [];
  return (props.options || []).filter(option =>
    option.label.toLowerCase().includes(search.value.toLowerCase())
  );
});

// Reset activeIndex when search results change
watch(filteredOptions, () => {
  activeIndex.value = filteredOptions.value.length > 0 ? 0 : -1;
});

// Keyboard navigation using VueUse
onKeyStroke(['ArrowDown', 'ArrowUp', 'Enter', 'Escape'], (event) => {
  if (!isOpen.value) return;

  const len = filteredOptions.value.length;
  if (len === 0) return;

  if (event.key === 'ArrowDown') {
    activeIndex.value = (activeIndex.value + 1) % len;
    event.preventDefault();
  } else if (event.key === 'ArrowUp') {
    activeIndex.value = (activeIndex.value - 1 + len) % len;
    event.preventDefault();
  } else if (event.key === 'Enter') {
    if (activeIndex.value >= 0 && activeIndex.value < len) {
      selectOption(filteredOptions.value[activeIndex.value].value);
      event.preventDefault();
    }
  } else if (event.key === 'Escape') {
    isOpen.value = false;
    event.preventDefault();
  }
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
  activeIndex.value = -1;
}

function clearSearch() {
  search.value = "";
  searchInput.value?.focus();
}

// Handle click outside using VueUse
onClickOutside(dropdownRef, () => {
  isOpen.value = false;
});
</script>

<template>
  <div ref="dropdownRef" class="form-control w-full">
    <label class="label">
      <span class="label-text font-semibold">
        {{ label }}<span v-if="required" class="text-error ml-1">*</span>
      </span>
    </label>

    <details class="dropdown dropdown-bottom w-full" :open="isOpen">
      <summary
        class="select select-bordered w-full flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden"
        :class="{ 'select-error': error, 'select-disabled cursor-not-allowed': disabled, 'pl-10': slots['icon-start'] }"
        @click.prevent="toggleDropdown"
      >
        <span
          v-if="slots['icon-start']"
          class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-base-content/50 pointer-events-none"
        >
          <slot name="icon-start" />
        </span>

        <span class="truncate pr-4" :class="{ 'opacity-50': !model && placeholder }">
          {{ selectedLabel }}
        </span>
      </summary>

      <div class="dropdown-content z-20 p-2 shadow-xl bg-base-100 rounded-box w-full border border-base-content/10 mt-1">
        <!-- Search field -->
        <div class="p-1 mb-2">
          <div class="relative">
            <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10 text-base-content/50" />
            <input
              ref="searchInput"
              v-model="search"
              class="input input-sm input-bordered w-full pl-9 pr-8"
              placeholder="Buscar..."
              @click.stop
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

        <!-- Options list -->
        <ul class="menu max-h-60 overflow-y-auto w-full p-0 flex-nowrap">
          <li v-for="(option, index) in filteredOptions" :key="option.value">
            <button
              type="button"
              class="flex items-center justify-between"
              :class="{ 'active': model === option.value || activeIndex === index }"
              @click="selectOption(option.value)"
              @mouseenter="activeIndex = index"
            >
              <span class="truncate">{{ option.label }}</span>
            </button>
          </li>

          <li v-if="filteredOptions.length === 0" class="disabled italic p-2 text-center opacity-50 text-sm">
            No hay resultados
          </li>
        </ul>

        <!-- Create button (conditional) -->
        <div v-if="showCreateButton" class="border-t border-base-content/5 mt-2 p-1 pt-2">
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
    </details>

    <label v-if="description" class="label py-1">
      <span class="label-text-alt text-base-content/60">{{ description }}</span>
    </label>

    <label v-if="error" class="label py-0">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>
