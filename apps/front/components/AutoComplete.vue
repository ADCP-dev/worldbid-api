<script setup lang="ts">
import { ref } from "vue";

interface Props {
  placeholder?: string;
  items?: Array<Item>;
  searchText?: string;
  emptyMessage?: string;
  createNewText?: string;
  onSearch?: (query: string) => void;
  onSelect?: (item: any) => void;
}

interface Item {
  label: string;
  value: number | string;
  data?: any;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "Buscar...",
  items: () => [],
  searchText: "Buscar...",
  emptyMessage: "No se encontraron resultados.",
  createNewText: "Crear nuevo",
});

const model = defineModel<string>();

const emit = defineEmits<{
  (e: "search", query: string): void;
  (e: "select", item: Item): void;
  (e: "create"): void;
}>();

const isOpen = ref(false);

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  model.value = target.value;
  if (props.onSearch) {
    props.onSearch(target.value);
  }
  emit("search", target.value);
  isOpen.value = true;
};

const handleSelect = (item: Item) => {
  if (props.onSelect) {
    props.onSelect(item);
  }
  emit("select", item);
  isOpen.value = false;
};

const handleCreateNew = () => {
  emit('create')
  isOpen.value = false;
};
</script>

<template>
  <div class="relative w-full dropdown" :class="{ 'dropdown-open': isOpen && (items.length > 0 || model) }">
    <div class="relative">
      <input
        v-model="model"
        type="text"
        :placeholder="placeholder"
        class="input input-bordered w-full"
        @focus="isOpen = true"
        @blur="setTimeout(() => isOpen = false, 200)"
        @input="handleInput"
      />
    </div>
    <div
      v-if="isOpen"
      class="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-full border border-base-content/20 mt-1 max-h-60 overflow-y-auto block"
    >
      <ul class="w-full p-0">
        <li v-if="!items.length" class="disabled px-4 py-2 text-sm opacity-70">
          {{ emptyMessage }}
        </li>
        <li v-for="item in items" :key="item.value">
          <a @click.prevent="handleSelect(item)" class="flex items-center px-4 py-2">
            {{ item.label }}
          </a>
        </li>
        <li class="border-t border-base-content/10 mt-1">
          <a @click.prevent="handleCreateNew" class="flex items-center justify-center text-primary font-semibold py-2">
            <AppIcon name="lucide:plus-circle" class="mr-2 h-4 w-4" />
            {{ createNewText }}
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>
