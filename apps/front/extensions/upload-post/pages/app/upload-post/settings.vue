<script setup lang="ts">
import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Settings as SettingsIcon, Webhook } from 'lucide-vue-next';
import PageShell from '../../components/PageShell.vue';
import {
  useConfigureWebhooksMutation,
  useMeQuery,
} from '../../composables/useUploadPostApi';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const { t } = useI18n();

const meQuery = useMeQuery();

const webhookForm = reactive({
  webhookUrl: '',
  telegramChatId: '',
  uploadCompleted: true,
  socialAccountConnected: true,
  socialAccountDisconnected: true,
  socialAccountReauthRequired: true,
});

const configureWebhooks = useConfigureWebhooksMutation();

async function onSaveWebhooks() {
  try {
    await configureWebhooks.mutateAsync({
      webhookUrl: webhookForm.webhookUrl,
      telegramChatId: webhookForm.telegramChatId || undefined,
      events: {
        uploadCompleted: webhookForm.uploadCompleted,
        socialAccountConnected: webhookForm.socialAccountConnected,
        socialAccountDisconnected: webhookForm.socialAccountDisconnected,
        socialAccountReauthRequired: webhookForm.socialAccountReauthRequired,
      },
    });
    toast.success(t('ext.upload-post.common.saved'));
  } catch (err: unknown) {
    toast.error(
      err instanceof Error ? err.message : t('ext.upload-post.common.requestFailed'),
    );
  }
}

const usagePercent = computed(() => {
  const me = meQuery.data.value;
  if (!me?.usage?.limit) return null;
  return Math.round(((me.usage.used ?? 0) / me.usage.limit) * 100);
});

const platformStatus = computed(() => meQuery.data.value ?? null);
const planLabel = computed(() => meQuery.data.value?.plan ?? '—');
</script>

<template>
  <PageShell
    :title="t('ext.upload-post.pages.settings.title')"
    :subtitle="t('ext.upload-post.pages.settings.subtitle')"
    :icon="SettingsIcon"
    :loading="meQuery.isLoading.value"
  >
    <div class="grid gap-6 lg:grid-cols-2">
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body gap-4">
          <h2 class="card-title text-base">
            <Webhook class="h-5 w-5" aria-hidden="true" />
            {{ t('ext.upload-post.pages.settings.webhooksTitle') }}
          </h2>
          <label class="form-control w-full">
            <span class="label-text mb-1">{{ t('ext.upload-post.pages.settings.webhookUrl') }}</span>
            <input
              v-model="webhookForm.webhookUrl"
              type="url"
              class="input input-bordered w-full"
              placeholder="https://example.com/webhooks/upload-post"
            >
          </label>
          <label class="form-control w-full">
            <span class="label-text mb-1">{{ t('ext.upload-post.pages.settings.telegramChatId') }}</span>
            <input
              v-model="webhookForm.telegramChatId"
              class="input input-bordered w-full"
              placeholder="-100123456789"
            >
          </label>
          <label class="label cursor-pointer justify-start gap-3">
            <input
              v-model="webhookForm.uploadCompleted"
              type="checkbox"
              class="toggle toggle-primary"
            >
            <span class="label-text">{{ t('ext.upload-post.pages.settings.eventUploadCompleted') }}</span>
          </label>
          <button
            type="button"
            class="btn btn-primary btn-sm w-fit"
            :disabled="webhookForm.webhookUrl.length === 0"
            @click="onSaveWebhooks"
          >
            {{ t('ext.upload-post.common.save') }}
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body gap-3">
            <h2 class="card-title text-base">
              {{ t('ext.upload-post.pages.settings.accountTitle') }}
            </h2>
            <p class="text-sm">
              {{ t('ext.upload-post.pages.settings.plan') }}:
              <span class="font-semibold">{{ planLabel }}</span>
            </p>
            <div v-if="usagePercent !== null" class="space-y-1">
              <progress
                class="progress progress-primary w-full"
                :value="usagePercent"
                max="100"
              />
              <p class="text-xs text-base-content/60">
                {{ usagePercent }}%
                {{ t('ext.upload-post.pages.settings.apiUsage') }}
              </p>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 border border-base-300">
          <div class="card-body gap-2">
            <h2 class="card-title text-base">
              {{ t('ext.upload-post.pages.settings.platformStatus') }}
            </h2>
            <pre class="text-xs bg-base-200 rounded-lg p-3 overflow-x-auto max-h-64">{{ JSON.stringify(platformStatus ?? {}, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </PageShell>
</template>