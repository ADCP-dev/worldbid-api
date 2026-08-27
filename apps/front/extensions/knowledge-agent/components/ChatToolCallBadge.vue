<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  Search,
  FileText,
  Wrench,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from 'lucide-vue-next';
import type { ChatToolCall } from '../composables/useChatStream';

const props = defineProps<{
  call: ChatToolCall;
}>();

const { t } = useI18n();

const open = ref(false);

/** Running = no output yet. */
const pending = computed(() => props.call.output === undefined);

const icon = computed(() => {
  const n = props.call.name.toLowerCase();
  if (n.includes('search') || n.includes('kb_')) return Search;
  if (n.includes('note') || n.includes('read') || n.includes('file')) return FileText;
  return Wrench;
});

/** Humanized action line: "🔍 Buscar en la base de conocimiento: cats". */
const summary = computed(() => {
  if (pending.value) {
    return t('ext.ka.chat.tools.running', 'Using {name}').replace('{name}', props.call.name);
  }
  return t('ext.ka.chat.tools.done', '{name} done').replace('{name}', props.call.name);
});

const argsPreview = computed(() => {
  const args = props.call.args;
  if (!args || Object.keys(args).length === 0) return null;
  try {
    const s = JSON.stringify(args);
    return s.length > 140 ? `${s.slice(0, 140)}…` : s;
  } catch {
    return null;
  }
});

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
      class="ka-tool-header w-full flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-300/60 hover:bg-base-300 text-xs font-mono text-base-content/80 transition-colors border border-base-300/80"
      :aria-expanded="open"
      @click="open = !open"
    >
      <component
        :is="pending ? Loader2 : CheckCircle2"
        :size="13"
        class="shrink-0"
        :class="pending ? 'animate-spin' : 'text-success'"
      />
      <component :is="icon" :size="13" class="shrink-0 opacity-70" />
      <span class="truncate">{{ summary }}</span>
      <ChevronRight
        :size="12"
        class="shrink-0 transition-transform ml-auto opacity-60"
        :class="{ 'rotate-90': open }"
      />
    </button>

    <!-- Expanded detail -->
    <div
      v-if="open"
      class="ka-tool-detail mt-1.5 ml-2 rounded-lg border border-base-300 bg-base-100 p-2.5 font-mono text-[11px] leading-snug space-y-2"
    >
      <div v-if="argsPreview" class="space-y-0.5">
        <div class="uppercase tracking-wide text-base-content/50 text-[10px] font-semibold">
          {{ t('ext.ka.chat.tools.args', 'Arguments') }}
        </div>
        <pre class="whitespace-pre-wrap break-all text-base-content/80">{{ argsPreview }}</pre>
      </div>
      <div v-if="pending" class="flex items-center gap-2 text-base-content/60 italic">
        <Loader2 :size="11" class="animate-spin" />
        {{ t('ext.ka.chat.tools.waiting', 'Waiting for result…') }}
      </div>
      <div v-else-if="outputPreview !== null" class="space-y-0.5">
        <div class="uppercase tracking-wide text-base-content/50 text-[10px] font-semibold">
          {{ t('ext.ka.chat.tools.result', 'Result') }}
        </div>
        <pre class="whitespace-pre-wrap break-all text-base-content/80">{{ outputPreview }}</pre>
      </div>
    </div>
  </div>
</template>
