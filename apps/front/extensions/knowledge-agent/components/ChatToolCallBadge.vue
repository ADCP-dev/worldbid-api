<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  Search,
  FileText,
  Wrench,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-vue-next';
import type { ChatToolCall } from '../composables/useChatStream';

const props = defineProps<{
  call: ChatToolCall;
}>();

const { t } = useI18n();

const open = ref(false);

/** Running = no output yet. */
const pending = computed(() => props.call.output === undefined);

/** Backend prefixes failed tool output with "Tool error:". */
const isError = computed(() => (props.call.output ?? '').startsWith('Tool error:'));

const icon = computed(() => {
  const n = props.call.name.toLowerCase();
  if (n.includes('search') || n.includes('kb_')) return Search;
  if (n.includes('note') || n.includes('read') || n.includes('file')) return FileText;
  return Wrench;
});

/** Accessibility hint on the collapsed row. */
const summary = computed(() => {
  if (pending.value) {
    return t('ext.ka.chat.tools.running', { name: props.call.name });
  }
  return t('ext.ka.chat.tools.done', { name: props.call.name });
});

const argsEntries = computed<Array<[string, unknown]>>(() => {
  const args = props.call.args;
  if (!args || typeof args !== 'object' || Array.isArray(args)) return [];
  return Object.entries(args);
});

function formatArgValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

const outputPreview = computed(() => {
  const out = props.call.output;
  if (out === undefined) return null;
  return out.length > 400 ? `${out.slice(0, 400)}…` : out;
});
</script>

<template>
  <div class="ka-tool-badge">
    <!-- Collapsed header -->
    <button
      type="button"
      class="ka-tool-header w-full flex items-center gap-2 px-2 py-1 rounded-xl bg-base-200/80 border border-base-300 hover:border-base-300/60 transition-colors"
      :title="summary"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="w-[22px] h-[22px] rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <component :is="icon" :size="12" />
      </span>
      <span class="font-mono text-xs truncate text-base-content/90">{{ call.name }}</span>
      <span class="ml-auto flex items-center gap-1 shrink-0">
        <Loader2 v-if="pending" :size="13" class="animate-spin text-warning" />
        <XCircle v-else-if="isError" :size="13" class="text-error" />
        <CheckCircle2 v-else :size="13" class="text-success" />
        <ChevronRight
          :size="12"
          class="shrink-0 transition-transform opacity-60"
          :class="{ 'rotate-90': open }"
        />
      </span>
    </button>

    <!-- Expanded detail -->
    <div
      v-if="open"
      class="ka-tool-detail mt-1.5 ml-3 rounded-xl border border-base-300 bg-base-100 p-2.5 space-y-2"
    >
      <div v-if="argsEntries.length > 0" class="space-y-1">
        <div class="text-base-content/50 font-mono text-[10px] uppercase tracking-wide">
          {{ t('ext.ka.chat.tools.args') }}
        </div>
        <div
          v-for="[key, value] in argsEntries"
          :key="key"
          class="grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-0.5"
        >
          <span class="text-base-content/50 font-mono text-[10px] uppercase">{{ key }}</span>
          <span class="font-mono text-xs break-all text-base-content/80">{{ formatArgValue(value) }}</span>
        </div>
      </div>

      <div v-if="pending" class="flex items-center gap-2 text-base-content/60">
        <Loader2 :size="11" class="animate-spin" />
        <span class="font-mono text-xs animate-pulse">{{ t('ext.ka.chat.tools.waiting') }}</span>
      </div>

      <div v-else-if="outputPreview !== null" class="space-y-1">
        <div
          class="font-mono text-[10px] uppercase tracking-wide"
          :class="isError ? 'text-error/80' : 'text-base-content/50'"
        >
          {{ t(isError ? 'ext.ka.chat.tools.error' : 'ext.ka.chat.tools.result') }}
        </div>
        <pre class="max-h-40 overflow-y-auto whitespace-pre-wrap break-all font-mono text-xs text-base-content/80">{{ outputPreview }}</pre>
      </div>
    </div>
  </div>
</template>
