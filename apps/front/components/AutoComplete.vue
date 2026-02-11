<script setup lang="ts">
import { ref } from "vue";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { PlusCircle } from "lucide-vue-next";

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
  <div class="relative w-full">
    <div class="relative">
      <Input
        v-model="model"
        :placeholder="placeholder"
        class="w-full"
        @focus="isOpen = true"
        @input="handleInput"
      />
    </div>
    <div
      v-show="isOpen"
      class="absolute z-50 min-w-[8rem] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
    >
      <Command class="w-full">
        <CommandList>
          <CommandEmpty v-if="!items.length">
            <div class="py-6 text-center text-sm">
              {{ emptyMessage }}
            </div>
          </CommandEmpty>
          <CommandGroup v-else>
            <CommandItem
              v-for="item in items"
              :key="item.value"
              :value="item.label"
              @select="() => handleSelect(item)"
              class="cursor-pointer"
            >
              {{ item.label }}
            </CommandItem>
          </CommandGroup>
          <CommandGroup>
            <CommandItem
              value=""
              @select="handleCreateNew"
              class="justify-center text-muted-foreground hover:text-primary border-t"
            >
              <PlusCircle class="mr-2 h-4 w-4" />
              {{ createNewText }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  </div>
</template>
