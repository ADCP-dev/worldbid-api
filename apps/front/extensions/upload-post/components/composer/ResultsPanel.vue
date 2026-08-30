<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CircleCheck, CircleX, Loader2, Undo } from 'lucide-vue-next';
import { useUploadStatusQuery } from '../../composables/useUploadPostApi';

const props = defineProps<{
  requestId: string | null;
  localId?: string;
}>();

const emit = defineEmits<{
  (e: 'reset'): void;
}>();

const { t } = useI18n();

const statusQuery = useUploadStatusQuery(
  computed(() => props.requestId),
);

interface Row {
  platform: string;
  state: 'success' | 'error' | 'pending';
  message?: string | null;
  postId?: string | null;
  postUrl?: string | null;
}

const rows = computed<Row[]>(() => {
  const platforms = statusQuery.data.value?.platforms ?? {};
  return Object.entries(platforms).map(([platform, result]) => ({
    platform,
    state:
      result.success === true
        ? 'success'
        : result.success === false
          ? 'error'
          : 'pending',
    message: result.error ?? null,
    postId: result.post_id ?? null,
    postUrl: result.post_url ?? null,
  }));
});

const overallState = computed(() => {
  const s = statusQuery.data.value?.status;
  if (s === 'success' || s === 'error') return s;
  if (rows.value.length > 0) {
    if (rows.value.every((r) => r.state === 'success')) return 'success';
    if (rows.value.every((r) => r.state === 'error')) return 'error';
  }
  return 'processing';
});
</script>

<template>
  <div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body gap-4">
      <div class="flex items-center justify-between">
        <h3 class="card-title text-base">
          {{ t('ext.upload-post.composer.resultsTitle') }}
        </h3>
        <button type="button" class="btn btn-ghost btn-sm" @click="emit('reset')">
          <Undo class="h-4 w-4" aria-hidden="true" />
          {{ t('ext.upload-post.composer.newPost') }}
        </button>
      </div>

      <div class="flex items-center gap-2 text-sm">
        <Loader2
          v-if="overallState === 'processing'"
          class="h-4 w-4 animate-spin"
          aria-hidden="true"
        />
        <span class="text-base-content/70">
          {{ t(`ext.upload-post.composer.overall.${overallState}`) }}
        </span>
        <code v-if="props.requestId" class="text-xs text-base-content/40">
          {{ props.requestId }}
        </code>
      </div>

      <div v-if="rows.length > 0" class="space-y-2">
        <div
          v-for="row in rows"
          :key="row.platform"
          class="flex items-center gap-3 rounded-lg border border-base-300 px-3 py-2"
        >
          <CircleCheck
            v-if="row.state === 'success'"
            class="h-5 w-5 text-success"
            aria-hidden="true"
          />
          <CircleX
            v-else-if="row.state === 'error'"
            class="h-5 w-5 text-error"
            aria-hidden="true"
          />
          <Loader2
            v-else
            class="h-5 w-5 animate-spin text-base-content/40"
            aria-hidden="true"
          />
          <span class="font-medium">
            {{ t(`ext.upload-post.platforms.${row.platform}`) }}
          </span>
          <span v-if="row.message" class="text-xs text-error truncate">
            {{ row.message }}
          </span>
          <a
            v-if="row.postUrl"
            :href="row.postUrl"
            target="_blank"
            rel="noopener"
            class="link link-primary link-xs ml-auto"
          >
            {{ t('ext.upload-post.composer.viewPost') }}
          </a>
        </div>
      </div>
      <p v-else class="text-sm text-base-content/60">
        {{ t('ext.upload-post.composer.pollingHint') }}
      </p>
    </div>
  </div>
</template>