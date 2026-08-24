<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useKnowledgeStore } from '@ka/stores/knowledge.store';

definePageMeta({
  layout: 'app',
});

const route = useRoute();
const store = useKnowledgeStore();

const title = ref('');
const contentMd = ref('');
const categoryPath = ref('');
const saving = ref(false);
const dirty = ref(false);

onMounted(async () => {
  const id = route.params.id as string;
  await store.loadNote(id);
  if (store.currentNote) {
    title.value = store.currentNote.title;
    contentMd.value = store.currentNote.contentMd;
    categoryPath.value = store.currentNote.categoryPath ?? '';
  }
});

watch([title, contentMd, categoryPath], () => {
  dirty.value = true;
});

async function save() {
  if (!store.currentNote) return;
  saving.value = true;
  try {
    await store.patchNote(store.currentNote.id, {
      title: title.value,
      contentMd: contentMd.value,
      categoryPath: categoryPath.value || null,
    } as any);
    dirty.value = false;
  } finally {
    saving.value = false;
  }
}

function goBack() {
  navigateTo('/knowledge');
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="navbar bg-base-200 border-b">
      <div class="navbar-start">
        <button class="btn btn-ghost btn-sm" @click="goBack">
          ← Back
        </button>
      </div>
      <div class="navbar-center">
        <span v-if="dirty" class="badge badge-warning badge-sm">Unsaved</span>
      </div>
      <div class="navbar-end">
        <button
          class="btn btn-primary btn-sm"
          :disabled="!dirty || saving"
          @click="save"
        >
          <span v-if="saving" class="loading loading-xs"></span>
          Save
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-6">
      <div v-if="store.loading" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
      <div v-else-if="!store.currentNote" class="text-center py-12 text-base-content/50">
        Note not found
      </div>
      <NoteEditor
        v-else
        v-model="contentMd"
        :title="title"
        :category-path="categoryPath"
        @update:title="title = $event"
        @update:category-path="categoryPath = $event"
        @save="save"
      />
    </div>
  </div>
</template>