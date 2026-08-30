<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import {
  useCreateCommissionMutation,
  useProjectsQuery,
} from '@affiliate/composables/useAffiliate';
import type { PipelineLine, Referral } from '@affiliate/types';

/**
 * CommissionModal — "apuntar comisión": link one project (budget) of the
 * referred client to a referral. Amount is computed server-side as
 * project.price × partner.commissionRate; duplicates are rejected.
 *
 * Two modes:
 *  - `line` given (pipeline context): referral is fixed, only pick project.
 *  - `referrals` given (commissions page): pick referral first, then project.
 */
const props = defineProps<{
  line?: PipelineLine;
  referrals?: Referral[];
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

const { t } = useI18n();

const createMut = useCreateCommissionMutation();

const selectedReferralId = ref<number | null>(props.line?.referralId ?? null);
const selectedProjectId = ref<number | null>(null);
const saving = ref(false);

// Referrals mode: options for the referral select
const referralOptions = computed(() =>
  (props.referrals ?? []).map((r) => ({
    value: r.id,
    label: `${r.partner?.name ?? r.clientName ?? ''} → ${r.client?.name ?? r.clientName ?? ''}`,
  })),
);

// Projects of the selected referral's client
const clientId = computed(() => {
  if (props.line) return props.line.clientId;
  const referral = (props.referrals ?? []).find(
    (r) => r.id === selectedReferralId.value,
  );
  return referral?.clientId ?? null;
});

const { data: projectsData, isLoading: projectsLoading } = useProjectsQuery(
  computed(() => clientId.value ?? undefined),
);

const projectOptions = computed(() =>
  (projectsData.value ?? []).map((p) => ({
    value: p.id,
    label: `${p.name} — ${new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(p.price ?? 0)}`,
  })),
);

// Rate preview: from the pipeline line's existing commissions when available
const rateHint = computed(() => {
  const rate = props.line?.projects.find((p) => p.commission)?.commission?.rate;
  if (!rate) return t('ext.affiliate.commissions.calcHint');
  return `${t('ext.affiliate.commissions.calcHint')} (${(rate * 100).toFixed(1).replace(/\.0$/, '')}%)`;
});

watch(selectedReferralId, () => {
  selectedProjectId.value = null;
});

async function submit() {
  const referralId = props.line?.referralId ?? selectedReferralId.value;
  if (!referralId || !selectedProjectId.value) {
    toast.error(t('ext.affiliate.common.error'));
    return;
  }
  saving.value = true;
  try {
    await createMut.mutateAsync({
      referralId: Number(referralId),
      projectId: Number(selectedProjectId.value),
    });
    toast.success(t('ext.affiliate.commissions.created'));
    emit('close');
  } catch (err: unknown) {
    toast.error(t('ext.affiliate.common.error'), { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <dialog class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-bold">{{ t('ext.affiliate.commissions.new') }}</h3>
      <p v-if="line" class="text-sm text-base-content/60 mt-1">
        {{ line.clientName }}
        <span v-if="line.companyName" class="text-base-content/40">({{ line.companyName }})</span>
      </p>
      <div class="py-4 space-y-4">
        <FormSelect
          v-if="!line"
          v-model="selectedReferralId"
          :label="t('ext.affiliate.commissions.selectReferral')"
          :options="referralOptions"
        />
        <FormSelect
          v-model="selectedProjectId"
          :label="t('ext.affiliate.commissions.selectProject')"
          :options="projectOptions"
          :disabled="projectsLoading || (!line && !selectedReferralId)"
        />
        <p class="text-xs text-base-content/50">{{ rateHint }}</p>
      </div>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="emit('close')">
          {{ t('ext.affiliate.common.cancel') }}
        </button>
        <button class="btn btn-primary" :disabled="saving" @click="submit">
          <span v-if="saving" class="loading loading-spinner loading-xs" />
          {{ t('ext.affiliate.common.create') }}
        </button>
      </div>
    </div>
    <div class="modal-backdrop" @click="emit('close')" />
  </dialog>
</template>