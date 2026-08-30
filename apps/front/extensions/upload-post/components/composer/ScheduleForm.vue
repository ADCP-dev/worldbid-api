<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import FormInput from '@base/ui-app/components/form/FormInput.vue';

const mode = defineModel<'now' | 'queue' | 'schedule'>('mode', {
  default: 'now',
});
const scheduledDate = defineModel<string>('scheduledDate', {
  default: '',
});

const { t } = useI18n();

const modes = [
  { value: 'now', key: 'now' },
  { value: 'queue', key: 'queue' },
  { value: 'schedule', key: 'schedule' },
] as const;
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap gap-3">
      <button
        v-for="m in modes"
        :key="m.key"
        type="button"
        class="btn"
        :class="mode === m.value ? 'btn-primary' : 'btn-outline'"
        @click="mode = m.value"
      >
        {{ t(`ext.upload-post.composer.scheduleModes.${m.key}`) }}
      </button>
    </div>

    <div v-if="mode === 'queue'" class="text-sm text-base-content/60">
      {{ t('ext.upload-post.composer.queueHint') }}
    </div>

    <FormInput
      v-if="mode === 'schedule'"
      v-model="scheduledDate"
      type="datetime-local"
      :label="t('ext.upload-post.composer.scheduleDateTime')"
    />
  </div>
</template>