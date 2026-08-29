<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import { useMyProfileQuery, useUpdateMyProfileMutation } from '../../../composables/useAffiliate';

definePageMeta({ layout: 'default', middleware: ['auth', 'affiliate'] });

const { t } = useI18n();

const { data: profile, isLoading } = useMyProfileQuery();
const updateMut = useUpdateMyProfileMutation();
const saving = ref(false);

const form = ref({
  phone: '',
  iban: '',
  companyName: '',
});

watchEffect(() => {
  if (profile.value) {
    form.value = {
      phone: profile.value.phone ?? '',
      iban: profile.value.iban ?? '',
      companyName: profile.value.companyName ?? '',
    };
  }
});

function rateLabel(rate: number | undefined) {
  if (rate === undefined) return '—';
  return `${(rate * 100).toFixed(1).replace(/\.0$/, '')}%`;
}

async function save() {
  saving.value = true;
  try {
    await updateMut.mutateAsync({
      phone: form.value.phone || undefined,
      iban: form.value.iban || undefined,
      companyName: form.value.companyName || undefined,
    });
    toast.success(t('ext.affiliate.common.saved'));
  } catch (err: unknown) {
    toast.error(t('ext.affiliate.common.error'), { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto space-y-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t('ext.affiliate.portal.profileTitle') }}</h1>
      <p class="text-base-content/60 mt-1 text-sm">{{ t('ext.affiliate.portal.profileHint') }}</p>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else-if="profile">
      <!-- Read-only identity -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-base">{{ t('ext.affiliate.partners.name') }}</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <p class="text-xs text-base-content/50">{{ t('ext.affiliate.partners.name') }}</p>
              <p class="font-medium">{{ profile.name }}</p>
            </div>
            <div>
              <p class="text-xs text-base-content/50">{{ t('ext.affiliate.portal.email') }}</p>
              <p class="font-medium">{{ profile.email }}</p>
            </div>
            <div>
              <p class="text-xs text-base-content/50">{{ t('ext.affiliate.common.code') }}</p>
              <p class="font-mono">{{ profile.code ?? '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-base-content/50">{{ t('ext.affiliate.portal.commissionRate') }}</p>
              <p class="font-medium">{{ rateLabel(profile.commissionRate) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Editable fields -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-base">{{ t('ext.affiliate.portal.bank') }}</h2>
          <div class="space-y-4 mt-2">
            <FormInput v-model="form.companyName" :label="t('ext.affiliate.partners.company')" />
            <FormInput v-model="form.phone" :label="t('ext.affiliate.partners.phone')" />
            <FormInput v-model="form.iban" :label="t('ext.affiliate.partners.iban')" />
          </div>
          <div class="card-actions justify-end mt-4">
            <button class="btn btn-primary" :disabled="saving" @click="save">
              <span v-if="saving" class="loading loading-spinner loading-xs" />
              {{ t('ext.affiliate.common.save') }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>