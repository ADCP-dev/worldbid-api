<script setup lang="ts">
import { ref, computed } from 'vue';
import { parseStackTrace, type StackFrame } from '@base/admin-viewer/utils/stack-trace-parser';

const props = defineProps<{ stack: string }>();

const frames = computed<StackFrame[]>(() => parseStackTrace(props.stack));

const selectedFrame = ref<StackFrame | null>(null);
const frameContent = ref<string | null>(null);
const loadingFrame = ref(false);

async function loadFrame(frame: StackFrame) {
  selectedFrame.value = frame;
  if (!frame.isAppCode) return;
  loadingFrame.value = true;
  try {
    const mcp = useMcp();
    frameContent.value = await mcp.getHandlerCode(
      frame.file.split('/')[0] ?? '',
      frame.file,
    );
  } catch {
    frameContent.value = null;
  } finally {
    loadingFrame.value = false;
  }
}
</script>

<template>
  <div class="space-y-1">
    <div v-if="frames.length === 0" class="text-base-content/50 py-4">
      No stack frames available.
    </div>

    <div
      v-for="(frame, i) in frames"
      :key="i"
      class="flex items-start gap-2 p-2 rounded hover:bg-base-200 cursor-pointer"
      :class="{ 'bg-primary/10': selectedFrame === frame }"
      @click="loadFrame(frame)"
    >
      <span class="text-base-content/40 font-mono text-sm">{{ i + 1 }}</span>
      <div class="flex-1">
        <span
          class="font-mono text-sm"
          :class="frame.isAppCode ? 'text-error' : 'text-base-content/60'"
        >
          {{ frame.functionName }}
        </span>
        <span class="font-mono text-xs text-base-content/50 ml-2">
          {{ frame.file }}:{{ frame.line }}:{{ frame.column }}
        </span>
      </div>
      <span v-if="frame.isAppCode" class="badge badge-error badge-xs">app</span>
      <span v-else-if="frame.isInternal" class="badge badge-ghost badge-xs">internal</span>
      <span v-else class="badge badge-ghost badge-xs">dep</span>
    </div>

    <div
      v-if="frameContent && selectedFrame"
      class="mt-4 bg-neutral rounded-box p-4 max-h-96 overflow-y-auto"
    >
      <div class="text-xs text-base-content/60 mb-2">
        {{ selectedFrame.file }}:{{ selectedFrame.line }}
      </div>
      <pre class="font-mono text-sm text-neutral-content"><code>{{ frameContent }}</code></pre>
    </div>
    <div v-else-if="loadingFrame" class="mt-4 flex justify-center">
      <span class="loading loading-spinner loading-sm" />
    </div>
  </div>
</template>