<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const props = defineProps<{ src: string; alt?: string; visible: boolean }>();
const emit = defineEmits(['close']);

const overlayRef = ref<HTMLElement | null>(null);
const closeBtnRef = ref<HTMLElement | null>(null);
const previousFocused = ref<HTMLElement | null>(null);

// Focus management: trap focus when lightbox opens, restore on close
watch(() => props.visible, async (v) => {
  if (v) {
    previousFocused.value = document.activeElement as HTMLElement;
    await nextTick();
    closeBtnRef.value?.focus();
  } else {
    previousFocused.value?.focus();
  }
});

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close');
    return;
  }
  if (e.key === 'Tab') {
    // Query focusable elements inside the lightbox
    const focusable = overlayRef.value?.querySelectorAll<HTMLElement>(
      'button, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Shift+Tab on first → wrap to last
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
    // Tab on last → wrap to first
    else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="overlayRef"
      role="dialog"
      aria-modal="true"
      :aria-label="alt || 'Image viewer'"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
      @keydown="onKeydown"
    >
      <!-- Visible close button with aria-label -->
      <button
        ref="closeBtnRef"
        type="button"
        aria-label="Close"
        class="absolute top-4 right-4 btn btn-sm btn-circle btn-ghost text-white text-xl z-[71]"
        @click="emit('close')"
      >
        ✕
      </button>
      <img
        :src="src"
        :alt="alt"
        tabindex="-1"
        class="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl"
      >
    </div>
  </Teleport>
</template>
