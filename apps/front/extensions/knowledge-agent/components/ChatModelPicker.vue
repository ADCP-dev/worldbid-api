<script setup lang="ts">
/**
 * Model + provider picker for the chat composer, OpenCode-style:
 *
 *   [🔧 GLM-5.3-Flash ▾]
 *
 * Opens a compact searchable popover listing the models registered for each
 * enabled provider (GET /ka/models + GET /ka/model-providers). Rows show the
 * display name over a muted provider name; the selected row gets a check.
 * "Gestionar modelos" at the bottom links to the models admin page.
 *
 * Selection persists through the existing AgentConfig.model plumbing
 * (update:model → parent PATCHes the agent config); this component owns no
 * storage of its own.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import {
  Check,
  ChevronDown,
  Search,
  Settings2,
  Wrench,
} from 'lucide-vue-next';
import {
  useModelProviders,
} from '@ka/composables/useAgentConfig';

const props = defineProps<{
  /** AgentConfig.model string, e.g. "openrouter:z-ai/glm-5.2". */
  modelId?: string | null;
  /** Marks every option as non-interactive (e.g. while streaming). */
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelId': [value: string];
  manage: [];
}>();

const { t } = useI18n();

const searchTerm = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);
const isOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const { getProviders, getModels } = useModelProviders();

const { data: providers } = useQuery({
  queryKey: ['ka-providers-enabled'],
  queryFn: getProviders,
});

const { data: registeredModels } = useQuery({
  queryKey: ['ka-models-registry'],
  queryFn: () => getModels(),
});

interface ModelOption {
  /** AgentConfig.model string ("provider:modelId"). */
  value: string;
  /** Human display name. */
  label: string;
  /** Provider display name (muted line under the label). */
  providerName: string;
}

/** One option per registered model of every enabled provider. */
const options = computed<ModelOption[]>(() => {
  const list: ModelOption[] = [];
  for (const m of registeredModels.value ?? []) {
    const prov = (providers.value ?? []).find((p) => p.id === m.providerId);
    if (!prov) continue;
    if (!prov.enabled) continue;
    list.push({
      value: `${prov.provider}:${m.modelId}`,
      label: m.displayName || m.modelId,
      providerName: prov.name,
    });
  }
  return list;
});

/** Current selection label: display name for the chip. */
const currentLabel = computed<string>(() => {
  const found = options.value.find((o) => o.value === props.modelId);
  if (found) return found.label;
  // Fall back to the raw modelId part of "provider:modelId".
  const raw = props.modelId ?? '';
  const idx = raw.indexOf(':');
  return idx === -1 ? raw || t('ext.ka.chat.modelFallback', 'Model') : (raw.slice(idx + 1) || raw);
});

const filteredOptions = computed<ModelOption[]>(() => {
  const q = searchTerm.value.trim().toLowerCase();
  if (!q) return options.value;
  return options.value.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      o.providerName.toLowerCase().includes(q) ||
      o.value.toLowerCase().includes(q),
  );
});

function toggleOpen(): void {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    requestAnimationFrame(() => searchInputRef.value?.focus());
  }
}

function closeDropdown(): void {
  isOpen.value = false;
  searchTerm.value = '';
}

function pick(value: string): void {
  emit('update:modelId', value);
  closeDropdown();
}

/** Selected model row detection, tolerant to a missing registry entry. */
function isSelected(option: ModelOption): boolean {
  return option.value === props.modelId;
}

function onDocumentClick(event: MouseEvent): void {
  const root = rootRef.value;
  if (!root) return;
  if (!root.contains(event.target as Node)) closeDropdown();
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('click', onDocumentClick);
  } else {
    document.removeEventListener('click', onDocumentClick);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
});
</script>

<template>
  <div
    ref="rootRef"
    class="relative shrink-0"
  >
    <button
      type="button"
      class="btn btn-ghost btn-sm gap-1 rounded-full text-base-content/70 hover:text-primary normal-case px-2"
      :disabled="disabled"
      :aria-label="t('ext.ka.chat.modelSelector')"
      :title="t('ext.ka.chat.modelSelector')
        + (modelId ? ` — ${modelId}` : '')"
      @click="toggleOpen"
    >
      <Wrench :size="14" />
      <span class="max-w-[150px] truncate text-xs font-medium">{{ currentLabel }}</span>
      <ChevronDown :size="12" class="opacity-60" />
    </button>

    <!-- Compact searchable popover -->
    <div
      v-if="isOpen"
      class="absolute bottom-full left-0 mb-2 z-50 w-72 rounded-xl border border-base-300 bg-base-100 shadow-xl overflow-hidden"
    >
      <div class="p-2 border-b border-base-300/70">
        <div class="relative">
          <Search
            :size="14"
            class="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"
          />
          <input
            ref="searchInputRef"
            v-model="searchTerm"
            type="text"
            :placeholder="t('ext.ka.chat.searchModels')"
            class="input input-sm input-bordered w-full pl-8 text-sm bg-base-200/50"
            @keydown.escape="closeDropdown"
          >
        </div>
      </div>

      <div class="max-h-64 overflow-y-auto p-1">
        <div
          v-if="options.length === 0"
          class="text-center text-xs text-base-content/40 py-6"
        >
          {{ t('ext.ka.settings.noModels') }}
        </div>
        <div v-else-if="filteredOptions.length === 0" class="text-center text-xs text-base-content/40 py-6">
          {{ t('ext.ka.chat.noResults') }}
        </div>
        <button
          v-for="opt in filteredOptions"
          :key="opt.value"
          type="button"
          class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-base-200/70"
          :class="{ 'bg-primary/10 hover:bg-primary/10': isSelected(opt) }"
          @click="pick(opt.value)"
        >
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-medium truncate">{{ opt.label }}</span>
            <span class="block text-[11px] text-base-content/50 truncate">{{ opt.providerName }}</span>
          </span>
          <Check
            v-if="isSelected(opt)"
            :size="15"
            class="shrink-0 text-primary"
          />
        </button>
      </div>

      <div class="border-t border-base-300/70 p-1">
        <button
          type="button"
          class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs text-base-content/60 hover:bg-base-200/70 transition-colors"
          @click="emit('manage')"
        >
          <Settings2 :size="14" class="shrink-0" />
          {{ t('ext.ka.chat.manageModels') }}
        </button>
      </div>
    </div>
  </div>
</template>