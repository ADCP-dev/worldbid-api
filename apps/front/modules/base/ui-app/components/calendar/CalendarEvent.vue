<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue';
import { format } from 'date-fns';
import type { CalendarEvent as CalendarEventType } from './types';

const props = withDefaults(defineProps<{
  event: CalendarEventType;
  compact?: boolean;
  style?: Record<string, string>;
}>(), {
  compact: false,
  style: () => ({}),
});

const emit = defineEmits<{
  (e: 'click', event: CalendarEventType): void;
  (e: 'drag-start'): void;
  (e: 'drag-end', payload: { clientX: number; clientY: number }): void;
}>();

const el = ref<HTMLElement>();
const isDragging = ref(false);
const hasMoved = ref(false);
const dragX = ref(0);
const dragY = ref(0);
const ghostX = ref(0);
const ghostY = ref(0);
const startPos = ref({ x: 0, y: 0 });
const DRAG_THRESHOLD = 5;

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  e.stopPropagation();
  startPos.value = { x: e.clientX, y: e.clientY };
  hasMoved.value = false;
  isDragging.value = false;
  el.value?.setPointerCapture(e.pointerId);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
}

function onPointerMove(e: PointerEvent) {
  const dx = e.clientX - startPos.value.x;
  const dy = e.clientY - startPos.value.y;
  
  if (!hasMoved.value && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
    hasMoved.value = true;
    isDragging.value = true;
    emit('drag-start');
  }

  if (isDragging.value) {
    ghostX.value = e.clientX - 40;
    ghostY.value = e.clientY - 10;
    dragX.value = dx;
    dragY.value = dy;
  }
}

function onPointerUp(e: PointerEvent) {
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);

  if (hasMoved.value) {
    emit('drag-end', { clientX: e.clientX, clientY: e.clientY });
  } else {
    emit('click', props.event);
  }

  isDragging.value = false;
  dragX.value = 0;
  dragY.value = 0;
}

onUnmounted(() => {
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
});

defineExpose({ el, isDragging });

const bgClass = computed(() => {
  return props.event.color || 'bg-primary';
});
</script>

<template>
  <div
    ref="el"
    class="rounded hover:opacity-90 select-none touch-none overflow-hidden"
    :class="[
      compact ? 'flex items-center gap-1 px-1' : 'text-xs truncate px-1 py-0.5',
      bgClass,
      isDragging ? 'cursor-grabbing opacity-30' : 'cursor-pointer',
    ]"
    :style="isDragging ? { opacity: '0.3', ...props.style } : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...props.style }"
    @pointerdown="onPointerDown"
    @click.prevent.stop
  >
    <span
      v-if="compact"
      class="w-2 h-2 rounded-full flex-shrink-0"
      :class="bgClass"
    />
    <span
      class="truncate"
      :class="[
        compact ? 'text-xs' : 'text-xs',
        event.textColor || 'text-primary-content',
      ]"
    >
      <span v-if="!compact">{{ format(event.start, 'HH:mm') }} </span>{{ event.title }}
    </span>
  </div>

  <!-- Ghost -->
  <Teleport to="body">
    <div
      v-if="isDragging"
      class="fixed pointer-events-none shadow-xl scale-105 z-[9999] rounded text-xs truncate px-1 py-0.5 text-primary-content"
      :class="bgClass"
      :style="{ left: ghostX + 'px', top: ghostY + 'px' }"
    >
      <span v-if="!compact">{{ format(event.start, 'HH:mm') }} </span>{{ event.title }}
    </div>
  </Teleport>
</template>
