<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';

const props = defineProps({
  width: {
    type: String,
    default: 'w-52'
  }
});

const isOpen = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);

const position = ref({ top: 0, left: 0 });

const updatePosition = () => {
  if (!triggerRef.value || !dropdownRef.value) return;

  const rect = triggerRef.value.getBoundingClientRect();
  const dropdownRect = dropdownRef.value.getBoundingClientRect();

  // Default to opening below and aligning to right edge (end)
  let top = rect.bottom + 4;
  let left = rect.right - dropdownRect.width;

  // Prevent going off screen bottom
  if (top + dropdownRect.height > window.innerHeight) {
    top = rect.top - dropdownRect.height - 4; // open upwards
  }

  // Prevent going off screen left
  if (left < 0) {
    left = rect.left; // align left edge
  }

  position.value = { top, left };
};

const toggle = async () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    await nextTick();
    updatePosition();
    // Use requestAnimationFrame to ensure the DOM is painted
    // before checking bounding rects for position adjustments
    requestAnimationFrame(updatePosition);
  }
};

const close = () => {
  isOpen.value = false;
};

// Handle click outside
const handleClickOutside = (event: MouseEvent) => {
  if (isOpen.value &&
      triggerRef.value && !triggerRef.value.contains(event.target as Node) &&
      dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    close();
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', close);
  window.addEventListener('scroll', close, true); // close on scroll anywhere
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', close);
  window.removeEventListener('scroll', close, true);
});

defineExpose({ close, toggle });

const dropdownStyle = computed(() => {
  return {
    top: `${position.value.top}px`,
    left: `${position.value.left}px`,
  };
});
</script>

<template>
  <div ref="triggerRef" class="inline-block" @click.stop="toggle">
    <slot name="trigger"/>
  </div>

  <Teleport to="body">
    <ul
      v-if="isOpen"
      ref="dropdownRef"
      class="fixed z-[9999] menu p-2 shadow-lg bg-base-100 rounded-box border border-base-200"
      :class="props.width"
      :style="dropdownStyle"
      @click.stop
    >
      <slot :close="close"/>
    </ul>
  </Teleport>
</template>
