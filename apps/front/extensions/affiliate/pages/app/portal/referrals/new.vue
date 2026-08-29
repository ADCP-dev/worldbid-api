<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { z } from 'zod';
import { toast } from 'vue-sonner';
import { RouterLink } from 'vue-router';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import { useCreateMyReferralMutation } from '../../../composables/useAffiliate';

definePageMeta({ layout: 'default', middleware: ['auth', 'affiliate'] });

const { t } = useI18n();

const schema = z.object({
  clientName: z.string().min(2),
  companyName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

const form = ref({
  clientName: '',
  companyName: '',
  email: '',
  phone: '',
  notes: '',
});

const errors = ref<Record<string, string>>({});
const createMut = useCreateMyReferralMutation();
const submitting = ref(false);

async function onSubmit() {
  errors.value = {};
  const parsed = schema.safeParse(form.value);
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => {
      errors.value[String(issue.path[0])] = issue.message;
    });
    return;
  }
  submitting.value = true;
  try {
    await createMut.mutateAsync({
      clientName: parsed.data.clientName,
      companyName: parsed.data.companyName || undefined,
      email: parsed.data.email,
      phone: parsed.data.phone || undefined,
      notes: parsed.data.notes || undefined,
    });
    toast.success(t('ext.affiliate.referralForm.success'));
    await navigateTo('/app/portal/referrals');
  } catch (err: unknown) {
    toast.error(t('ext.affiliate.common.error'), { description: errorMessage(err) });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto space-y-4">
    <div>
      <NuxtLink to="/app/portal/referrals" class="btn btn-ghost btn-sm btn-circle mb-2">←</NuxtLink>
      <h1 class="text-2xl font-bold">{{ t('ext.affiliate.portal.newReferral') }}</h1>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <form class="space-y-4" @submit.prevent="onSubmit">
          <FormInput
            v-model="form.clientName"
            :label="t('ext.affiliate.referralForm.clientName')"
            required
            :error="errors.clientName"
          />
          <FormInput
            v-model="form.companyName"
            :label="t('ext.affiliate.referralForm.companyName')"
            :error="errors.companyName"
          />
          <FormInput
            v-model="form.email"
            :label="t('ext.affiliate.referralForm.email')"
            type="email"
            required
            :error="errors.email"
          />
          <FormInput
            v-model="form.phone"
            :label="t('ext.affiliate.referralForm.phone')"
            :error="errors.phone"
          />
          <FormTextArea
            v-model="form.notes"
            :label="t('ext.affiliate.referralForm.notes')"
            :rows="3"
          />
          <div class="flex justify-end gap-2">
            <NuxtLink to="/app/portal/referrals" class="btn btn-ghost">
              {{ t('ext.affiliate.common.cancel') }}
            </NuxtLink>
            <button type="submit" class="btn btn-primary" :disabled="submitting">
              <span v-if="submitting" class="loading loading-spinner loading-xs" />
              {{ t('ext.affiliate.referralForm.submit') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>