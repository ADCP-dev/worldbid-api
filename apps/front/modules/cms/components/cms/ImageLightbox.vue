<script setup lang="ts">
defineProps<{ src: string; alt?: string; visible: boolean }>();
const emit = defineEmits(["close"]);

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
      @click="emit('close')"
      @keydown="onKeydown"
    >
      <img
        :src="src"
        :alt="alt"
        class="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl"
        @click.stop
      >
    </div>
  </Teleport>
</template>
