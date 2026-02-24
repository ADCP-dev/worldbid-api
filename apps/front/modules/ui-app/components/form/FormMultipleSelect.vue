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
  if (!(e.target as HTMLElement).closest(".dropdown")) {
    closeDropdown();
  }
}

watch(open, (val) => {
  if (val) document.addEventListener("mousedown", handleClickOutside);
  else document.removeEventListener("mousedown", handleClickOutside);
});
</script>

<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text font-semibold">
        {{ label }}
      </span>
    </label>

    <div class="dropdown w-full" :class="{ 'dropdown-open': open }">
      <div
        tabindex="0"
        role="button"
        class="select select-bordered w-full flex flex-wrap gap-1 h-auto min-h-[3rem] py-2 items-center justify-between"
        :class="{ 'select-error': error, 'select-disabled cursor-not-allowed': disabled }"
        @click="toggleDropdown"
      >
        <div class="flex flex-wrap gap-1 items-center">
          <span
            v-if="selected.length === 0"
            class="opacity-50 text-sm"
          >
            {{ placeholder || "Selecciona opciones..." }}
          </span>
          <div
            v-for="val in selected"
            :key="val"
            class="badge badge-primary gap-1 py-3"
          >
            <span class="max-w-[150px] truncate">
              {{ options.find((opt) => opt.value === val)?.label || val }}
            </span>
            <X
              class="w-3 h-3 cursor-pointer hover:text-error transition-colors"
              @click.stop="removeSelected(val)"
            />
          </div>
        </div>
        <ChevronDown class="h-4 w-4 opacity-50 ml-auto" />
      </div>

      <div
        v-if="open"
        class="dropdown-content z-20 menu p-2 shadow-xl bg-base-100 rounded-box w-full border  mt-1"
      >
        <div class="p-1 mb-2">
          <input
            ref="inputRef"
            v-model="search"
            type="text"
            class="input input-sm input-bordered w-full"
            placeholder="Buscar..."
            @click.stop
          />
        </div>

        <ul class="max-h-60 overflow-y-auto w-full">
          <li v-for="opt in filteredOptions" :key="opt.value">
            <button
              type="button"
              class="w-full flex items-center justify-between"
              :class="{ 'active': isSelected(opt.value) }"
              @click="toggleSelect(opt.value)"
            >
              <span class="truncate">{{ opt.label }}</span>
              <Check v-if="isSelected(opt.value)" class="h-4 w-4" />
            </button>
          </li>

          <li v-if="filteredOptions.length === 0" class="disabled italic p-2 text-center opacity-50 text-sm">
            Sin resultados
          </li>
        </ul>
      </div>
    </div>

    <label v-if="description" class="label py-1">
      <span class="label-text-alt text-base-content/60">{{ description }}</span>
    </label>

    <label v-if="error" class="label py-1">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
