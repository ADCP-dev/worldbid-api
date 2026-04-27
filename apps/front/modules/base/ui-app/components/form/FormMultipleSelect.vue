<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Check, ChevronDown, X } from "lucide-vue-next";

const props = defineProps<{
  label?: string;
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
const dropdownRef = ref<HTMLElement | null>(null);

const selected = computed(() => props.modelValue ?? []);

const selectedLabels = computed(() =>
  selected.value.map((val) => {
    const opt = props.options.find((o) => o.value === val);
    return opt?.label || String(val);
  })
);

const filteredOptions = computed(() =>
  props.options.filter((opt) =>
    opt.label.toLowerCase().includes(search.value.toLowerCase())
  )
);

function toggleDropdown() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) search.value = "";
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

function removeSelected(value: string | number, event?: Event) {
  event?.stopPropagation();
  emit(
    "update:modelValue",
    selected.value.filter((v) => v !== value)
  );
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    closeDropdown();
  }
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    closeDropdown();
  }
}

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
  document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", handleClickOutside);
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div ref="dropdownRef" class="form-control w-full relative">
    <label v-if="label" class="label">
      <span class="label-text font-semibold">
        {{ label }}
      </span>
    </label>

    <!-- Trigger -->
    <button
      type="button"
      class="select select-bordered w-full flex flex-wrap gap-1 h-auto min-h-[3rem] py-2 px-3 items-center justify-between text-left"
      :class="{ 'select-error': error, 'select-disabled cursor-not-allowed opacity-60': disabled }"
      :disabled="disabled"
      @click="toggleDropdown"
    >
      <div class="flex flex-wrap gap-1 items-center flex-1">
        <span
          v-if="selected.length === 0"
          class="opacity-50 text-sm"
        >
          {{ placeholder || "Selecciona opciones..." }}
        </span>
        <div
          v-for="(val, idx) in selected"
          :key="val"
          class="badge badge-primary gap-1 py-2.5 px-2"
          @click.stop="removeSelected(val)"
        >
          <span class="max-w-[150px] truncate">
            {{ selectedLabels[idx] }}
          </span>
          <X
            class="w-3 h-3 cursor-pointer hover:text-error transition-colors"
          />
        </div>
      </div>
      <ChevronDown
        class="h-4 w-4 opacity-50 ml-2 shrink-0 transition-transform"
        :class="{ 'rotate-180': open }"
      />
    </button>

    <!-- Dropdown Menu -->
    <div
      v-show="open"
      class="absolute z-50 left-0 right-0 top-full mt-1 bg-base-100 rounded-box shadow-xl border p-2"
    >
      <!-- Search -->
      <div class="p-1 mb-2">
        <input
          v-model="search"
          type="text"
          class="input input-sm input-bordered w-full"
          placeholder="Buscar..."
          @click.stop
        />
      </div>

      <!-- Options -->
      <ul class="max-h-60 overflow-y-auto">
        <li
          v-for="opt in filteredOptions"
          :key="opt.value"
        >
          <button
            type="button"
            class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-base-200 transition-colors"
            :class="{ 'bg-primary/10 text-primary': isSelected(opt.value) }"
            @click="toggleSelect(opt.value)"
          >
            <span class="truncate">{{ opt.label }}</span>
            <Check
              v-if="isSelected(opt.value)"
              class="h-4 w-4 shrink-0 ml-2"
            />
          </button>
        </li>

        <li
          v-if="filteredOptions.length === 0"
          class="italic p-3 text-center opacity-50 text-sm"
        >
          Sin resultados
        </li>
      </ul>
    </div>

    <!-- Description / Error -->
    <label v-if="description" class="label py-1">
      <span class="label-text-alt text-base-content/60">{{ description }}</span>
    </label>

    <label v-if="error" class="label py-1">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>

<style scoped>
/* Custom scrollbar for dropdown */
ul::-webkit-scrollbar {
  width: 6px;
}
ul::-webkit-scrollbar-track {
  background: transparent;
}
ul::-webkit-scrollbar-thumb {
  background: hsl(var(--bc) / 0.2);
  border-radius: 3px;
}
</style>