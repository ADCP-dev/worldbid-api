<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { ListOrdered } from 'lucide-vue-next';
import PageShell from '@upload-post/components/PageShell.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import WeekdayPicker from '@base/ui-app/components/form/WeekdayPicker.vue';
import {
  useQueueSettingsQuery,
  useUpdateQueueSettingsMutation,
  useQueuePreviewQuery,
  useQueueNextSlotQuery,
  type UpQueueSettings,
} from '@upload-post/composables/useUploadPostApi';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const { t } = useI18n();

const settingsQuery = useQueueSettingsQuery();
const updateSettings = useUpdateQueueSettingsMutation();
const previewQuery = useQueuePreviewQuery();
const nextSlotQuery = useQueueNextSlotQuery();

const form = reactive<UpQueueSettings>({
  publishDays: 'mon,wed,fri',
  publishTime: '18:00',
  maxPerWeek: 5,
  skipWeekends: false,
  timezone: 'UTC',
});

watch(
  () => settingsQuery.data.value,
  (data) => {
    if (data) Object.assign(form, data);
  },
  { immediate: true },
);

const dirty = computed(
  () => JSON.stringify(form) !== JSON.stringify(settingsQuery.data.value ?? {}),
);

async function onSave() {
  try {
    await updateSettings.mutateAsync({ ...form });
    toast.success(t('ext.upload-post.common.saved'));
  } catch (err: unknown) {
    toast.error(
      err instanceof Error ? err.message : t('ext.upload-post.common.requestFailed'),
    );
  }
}

const selectedDays = computed({
  get: () => (form.publishDays ?? '').split(',').filter(Boolean),
  set: (days: string[]) => {
    form.publishDays = days.join(',');
  },
});
</script>

<template>
  <PageShell
    :title="t('ext.upload-post.pages.queue.title')"
    :subtitle="t('ext.upload-post.pages.queue.subtitle')"
    :icon="ListOrdered"
    :loading="settingsQuery.isLoading.value"
  >
    <div class="grid gap-6 lg:grid-cols-2">
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body gap-4">
          <h2 class="card-title text-base">
            {{ t('ext.upload-post.pages.queue.settingsTitle') }}
          </h2>
          <FormInput
            v-model="form.publishTime"
            type="time"
            :label="t('ext.upload-post.pages.queue.publishTime')"
          />
          <WeekdayPicker v-model="selectedDays" />
          <FormInput
            v-model.number="form.maxPerWeek"
            type="number"
            :label="t('ext.upload-post.pages.queue.maxPerWeek')"
          />
          <FormSwitch
            v-model="form.skipWeekends"
            :label="t('ext.upload-post.pages.queue.skipWeekends')"
          />
          <FormInput
            v-model="form.timezone"
            :label="t('ext.upload-post.pages.queue.timezone')"
          />
          <button
            type="button"
            class="btn btn-primary btn-sm w-fit"
            :disabled="!dirty || updateSettings.isPending.value"
            @click="onSave"
          >
            {{ t('ext.upload-post.common.save') }}
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body gap-2">
            <h2 class="card-title text-base">
              {{ t('ext.upload-post.pages.queue.nextSlot') }}
            </h2>
            <p class="text-lg font-semibold">
              {{ nextSlotQuery.data.value ?? '—' }}
            </p>
          </div>
        </div>
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body gap-2">
            <h2 class="card-title text-base">
              {{ t('ext.upload-post.pages.queue.preview') }}
            </h2>
            <pre class="text-xs bg-base-200 rounded-lg p-3 overflow-x-auto">{{ JSON.stringify(previewQuery.data.value ?? {}, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </PageShell>
</template>