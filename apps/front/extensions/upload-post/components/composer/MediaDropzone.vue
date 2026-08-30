<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import FormMultipleFile from '@base/ui-app/components/form/FormMultipleFile.vue';
import FormFile from '@base/ui-app/components/form/FormFile.vue';

const props = defineProps<{
  mediaType: 'video' | 'photos' | 'text' | 'document';
}>();

const files = defineModel<File[]>('files', { default: () => [] });
const mediaUrls = defineModel<string[]>('urls', { default: () => [] });

const { t } = useI18n();

const isMultiple = computed(() => props.mediaType === 'photos');

const accept = computed(() => {
  if (props.mediaType === 'video') return 'video/*';
  if (props.mediaType === 'photos') return 'image/*';
  return '.pdf,.ppt,.pptx,.doc,.docx';
});

const newUrl = ref('');

function addUrl() {
  const v = newUrl.value.trim();
  if (!v) return;
  mediaUrls.value = [...mediaUrls.value, v];
  newUrl.value = '';
}

function removeUrl(idx: number) {
  mediaUrls.value = mediaUrls.value.filter((_, i) => i !== idx);
}

const currentFiles = computed({
  get: () => (isMultiple.value ? files.value : (files.value[0] ?? null)),
  set: (value: File | File[] | null) => {
    if (isMultiple.value) files.value = (value as File[]) ?? [];
    else files.value = value ? [value as File] : [];
  },
});
</script>

<template>
  <div class="space-y-6">
    <FormMultipleFile
      v-if="isMultiple"
      v-model="files"
      :label="t('ext.upload-post.composer.selectPhotos')"
      accept="image/*"
    />
    <FormFile
      v-else
      v-model="currentFiles"
      :label="t('ext.upload-post.composer.selectFile')"
      :accept="accept"
    />

    <div class="divider text-xs text-base-content/50">
      {{ t('ext.upload-post.composer.orUrl') }}
    </div>

    <div class="flex gap-2 max-w-lg">
      <input
        v-model="newUrl"
        type="url"
        class="input input-bordered w-full"
        :placeholder="t('ext.upload-post.composer.mediaUrlPlaceholder')"
      >
      <button type="button" class="btn btn-outline" @click="addUrl">
        {{ t('ext.upload-post.composer.addUrl') }}
      </button>
    </div>

    <ul v-if="mediaUrls.length > 0" class="space-y-1">
      <li
        v-for="(u, i) in mediaUrls"
        :key="u"
        class="flex items-center gap-2 text-sm"
      >
        <span class="truncate max-w-xs text-base-content/70">{{ u }}</span>
        <button
          type="button"
          class="btn btn-ghost btn-xs text-error"
          @click="removeUrl(i)"
        >
          {{ t('ext.upload-post.common.remove') }}
        </button>
      </li>
    </ul>

    <p class="text-xs text-base-content/50">
      {{ t('ext.upload-post.composer.mediaHint') }}
    </p>
  </div>
</template>