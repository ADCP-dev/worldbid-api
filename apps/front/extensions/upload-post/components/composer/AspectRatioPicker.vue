<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { UpAspectRatio, UpMediaType } from '../../types';
import { UP_ASPECT_RATIOS, UP_MEDIA_TYPES } from '../../lib/platform-matrix';

const aspectRatio = defineModel<UpAspectRatio | null>('ratio', {
  default: null,
});
const mediaType = defineModel<UpMediaType | null>('type', {
  default: null,
});

const { t } = useI18n();
</script>

<template>
  <div class="space-y-8">
    <div>
      <h3 class="text-sm font-semibold mb-3">
        {{ t('ext.upload-post.composer.aspectRatio') }}
      </h3>
      <div class="flex flex-wrap gap-3">
        <button
          v-for="ratio in UP_ASPECT_RATIOS"
          :key="ratio"
          type="button"
          class="btn"
          :class="aspectRatio === ratio ? 'btn-primary' : 'btn-outline'"
          @click="aspectRatio = ratio"
        >
          {{ ratio }}
        </button>
      </div>
    </div>
    <div>
      <h3 class="text-sm font-semibold mb-3">
        {{ t('ext.upload-post.composer.mediaType') }}
      </h3>
      <div class="flex flex-wrap gap-3">
        <button
          v-for="mt in UP_MEDIA_TYPES"
          :key="mt"
          type="button"
          class="btn"
          :class="mediaType === mt ? 'btn-primary' : 'btn-outline'"
          @click="mediaType = mt"
        >
          {{ t(`ext.upload-post.composer.mediaTypes.${mt}`) }}
        </button>
      </div>
      <p
        v-if="mediaType === 'document'"
        class="text-sm text-warning mt-2"
      >
        {{ t('ext.upload-post.composer.documentLinkedinOnly') }}
      </p>
    </div>
  </div>
</template>