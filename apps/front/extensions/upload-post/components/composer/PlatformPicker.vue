<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check } from 'lucide-vue-next';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import {
  useFacebookPagesQuery,
  useLinkedinPagesQuery,
  usePinterestBoardsQuery,
} from '../../composables/useUploadPostApi';

const props = defineProps<{
  allPlatforms: string[];
  selected: string[];
}>();

const emit = defineEmits<{
  (e: 'toggle', platform: string): void;
}>();

const { t } = useI18n();

const facebookPageId = defineModel<string>('facebookPageId', { default: '' });
const linkedinPageId = defineModel<string>('linkedinPageId', { default: '' });
const pinterestBoard = defineModel<string>('pinterestBoard', { default: '' });

const facebookEnabled = computed(() => props.selected.includes('facebook'));
const linkedinEnabled = computed(() => props.selected.includes('linkedin'));
const pinterestEnabled = computed(() => props.selected.includes('pinterest'));

const { data: facebookPages } = useFacebookPagesQuery(facebookEnabled);
const { data: linkedinPages } = useLinkedinPagesQuery(linkedinEnabled);
const { data: pinterestBoards } = usePinterestBoardsQuery(pinterestEnabled);

const selectedSet = computed(() => new Set(props.selected));

const destinationPlatforms = computed(() =>
  props.selected.filter(
    (p) => p === 'facebook' || p === 'linkedin' || p === 'pinterest',
  ),
);

const destinationLabel = (platform: string) =>
  platform === 'facebook'
    ? t('ext.upload-post.composer.destinations.facebookPage')
    : platform === 'linkedin'
      ? t('ext.upload-post.composer.destinations.linkedinPage')
      : t('ext.upload-post.composer.destinations.pinterestBoard');
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap gap-3">
      <button
        v-for="platform in props.allPlatforms"
        :key="platform"
        type="button"
        class="btn"
        :class="selectedSet.has(platform) ? 'btn-primary' : 'btn-outline'"
        :disabled="props.allPlatforms.length === 1 && platform === 'linkedin' && !selectedSet.has('linkedin')"
        @click="emit('toggle', platform)"
      >
        <Check
          v-if="selectedSet.has(platform)"
          class="h-4 w-4"
          aria-hidden="true"
        />
        {{ t(`ext.upload-post.platforms.${platform}`) }}
      </button>
    </div>

    <p
      v-if="props.allPlatforms.length === 0"
      class="text-sm text-base-content/60"
    >
      {{ t('ext.upload-post.composer.noPlatformsForSelection') }}
    </p>

    <div
      v-for="platform in destinationPlatforms"
      :key="`dest-${platform}`"
      class="max-w-sm"
    >
      <FormSelect
        v-if="platform === 'facebook'"
        v-model="facebookPageId"
        :label="destinationLabel(platform)"
        :options="(facebookPages ?? []).map((p) => ({ value: p.id ?? '', label: p.name }))"
      />
      <FormSelect
        v-else-if="platform === 'linkedin'"
        v-model="linkedinPageId"
        :label="destinationLabel(platform)"
        :options="(linkedinPages ?? []).map((p) => ({ value: p.id ?? '', label: p.name }))"
      />
      <FormSelect
        v-else
        v-model="pinterestBoard"
        :label="destinationLabel(platform)"
        :options="(pinterestBoards ?? []).map((p) => ({ value: p.id ?? p.name, label: p.name }))"
      />
    </div>
  </div>
</template>