<script setup lang="ts">
import RichEditorAdvanced from "@cms/components/cms/RichEditorAdvanced.vue";

defineProps<{
  title: string;
  content: string;
  postId: string;
  visible: boolean;
}>();

const emit = defineEmits(["close"]);
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-2"
    @click.self="emit('close')"
  >
    <div class="bg-base-100 w-full h-full flex flex-col rounded-lg overflow-hidden">
      <div class="flex justify-between items-center p-4 border-b">
        <h3 class="text-xl font-bold">Vista previa</h3>
        <button type="button" class="btn btn-sm btn-ghost" @click="emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="flex-1 flex overflow-hidden">
        <div class="w-1/2 border-r overflow-hidden flex flex-col">
          <div class="bg-base-200 px-3 py-2 text-xs font-semibold text-base-content/60 uppercase tracking-wider">
            Fuente
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            <RichEditorAdvanced
              :model-value="content"
              entity-name="BlogPost"
              :entity-id="postId"
              class="min-h-full"
            />
          </div>
        </div>
        <div class="w-1/2 overflow-hidden flex flex-col bg-base-200">
          <div class="bg-base-200 px-3 py-2 text-xs font-semibold text-base-content/60 uppercase tracking-wider">
            Renderizado
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            <div class="prose max-w-none bg-base-100 p-6 rounded-lg shadow-sm min-h-full">
              <div v-if="title" class="mb-6">
                <h1 class="text-3xl font-bold mb-4">{{ title }}</h1>
              </div>
              <div v-if="content" v-html="content" />
              <p v-else class="text-base-content/40 italic">El contenido aparecerá aquí...</p>
            </div>
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-2 px-4 py-2 border-t bg-base-100">
        <button type="button" class="btn btn-sm btn-ghost" @click="emit('close')">Cerrar</button>
      </div>
    </div>
  </div>
</template>
