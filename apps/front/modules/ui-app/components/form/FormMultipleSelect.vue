<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { Check, ChevronDown, X } from "lucide-vue-next";

const props = defineProps<{
  label?: string;
  name?: string;
  options: Array<{ value: string | number; label: string }>;
  modelValue?: Array<string | number>;
  error?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: Array<string | number>): void;
}>();

const open = ref(false);
const search = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

const selected = computed(() => props.modelValue ?? []);

const filteredOptions = computed(() =>
  props.options.filter((opt) =>
    opt.label.toLowerCase().includes(search.value.toLowerCase())
  )
);

function toggleDropdown() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) nextTick(() => inputRef.value?.focus());
}

function closeDropdown() {
  open.value = false;
  search.value = "";
}

function toggleSelect(value: string | number) {
  if (props.disabled) return;
  const idx = selected.value.indexOf(value);
  let updated: Array<string | number>;
  if (idx === -1) {
    updated = [...selected.value, value];
  } else {
    updated = selected.value.filter((v) => v !== value);
  }
  emit("update:modelValue", updated);
}

function isSelected(value: string | number) {
  return selected.value.includes(value);
}

function removeSelected(value: string | number) {
  emit(
    "update:modelValue",
    selected.value.filter((v) => v !== value)
  );
}

function handleClickOutside(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest(".fms-dropdown")) {
    closeDropdown();
  }
}
watch(open, (val) => {
  if (val) document.addEventListener("mousedown", handleClickOutside);
  else document.removeEventListener("mousedown", handleClickOutside);
});
</script>

<template>
  <div class="space-y-2">
    <label
      v-if="label"
      :for="name"
      class="block text-sm font-medium text-foreground"
    >
      {{ label }}
    </label>
    <div class="relative">
      <button
        type="button"
        class="w-full border-input flex items-center justify-between border rounded-lg px-3 py-2 dark:bg-input/30 dark:hover:bg-input/50 text-left focus:outline-none focus:ring-2 focus:ring-primary transition min-h-[42px]"
        :class="[
          error ? 'border-destructive' : 'border-muted',
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
        ]"
        :disabled="disabled"
        @click="toggleDropdown"
      >
        <div class="flex flex-wrap gap-1">
          <span
            v-if="selected.length === 0"
            class="text-muted-foreground text-sm"
          >
            {{ placeholder || "Selecciona opciones..." }}
          </span>
          <span
            v-for="val in selected"
            :key="val"
            class="flex items-center bg-primary/10 text-primary rounded px-2 py-0.5 text-xs"
          >
            {{ options.find((opt) => opt.value === val)?.label || val }}
            <X
              class="ml-1 w-3 h-3 cursor-pointer hover:text-destructive"
              @click.stop="removeSelected(val)"
            />
          </span>
        </div>
        <ChevronDown class="w-4 h-4 text-muted-foreground ml-2" />
      </button>
      <Transition name="fade">
        <div
          v-if="open"
          class="fms-dropdown absolute z-30 mt-2 w-full bg-popover border border-muted rounded-lg shadow-lg p-2"
        >
          <input
            ref="inputRef"
            v-model="search"
            type="text"
            class="w-full mb-2 px-2 py-1 rounded border border-muted focus:outline-none focus:border-primary text-sm"
            placeholder="Buscar..."
          />
          <ul class="max-h-48 overflow-auto space-y-1">
            <li
              v-for="opt in filteredOptions"
              :key="opt.value"
              class="flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition hover:bg-muted select-none"
              :class="
                isSelected(opt.value) ? 'bg-primary/10 font-semibold' : ''
              "
              @click="toggleSelect(opt.value)"
            >
              <span
                class="inline-flex items-center justify-center w-5 h-5 border rounded mr-2"
                :class="
                  isSelected(opt.value)
                    ? 'border-primary bg-primary text-white'
                    : 'border-muted bg-background'
                "
              >
                <Check v-if="isSelected(opt.value)" class="w-4 h-4" />
              </span>
              <span class="truncate">{{ opt.label }}</span>
            </li>
            <li
              v-if="filteredOptions.length === 0"
              class="text-muted-foreground text-sm px-2 py-1"
            >
              Sin resultados
            </li>
          </ul>
        </div>
      </Transition>
    </div>
    <p v-if="description" class="text-xs text-muted-foreground">
      {{ description }}
    </p>
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
  </div>
</template>
