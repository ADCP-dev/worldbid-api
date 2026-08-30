<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Handshake, RefreshCw } from 'lucide-vue-next';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import ContactsCard from '@crm/components/ContactsCard.vue';
import InteractionsCard from '../../../components/InteractionsCard.vue';
import ProjectsCard from '../../../components/ProjectsCard.vue';
import {
  useClientQuery,
  useStatusesQuery,
  useOriginsQuery,
  useUpdateClientMutation,
} from '@crm/composables/useCrm';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const { t } = useI18n();
const route = useRoute();
const clientId = computed(() => route.params.id as string);

const { data: client, isLoading } = useClientQuery(clientId);
const { data: statuses } = useStatusesQuery();
const { data: origins } = useOriginsQuery();
const updateMut = useUpdateClientMutation();

const saving = ref(false);

const edit = ref({
  name: '',
  companyName: '',
  nif: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  region: '',
  country: 'España',
  statusId: null as number | null,
  originId: null as number | null,
  isActive: true,
});

watchEffect(() => {
  if (client.value) {
    edit.value = {
      name: client.value.name ?? '',
      companyName: client.value.companyName ?? '',
      nif: client.value.nif ?? '',
      email: client.value.email ?? '',
      phone: client.value.phone ?? '',
      address: client.value.address ?? '',
      city: client.value.city ?? '',
      region: client.value.region ?? '',
      country: client.value.country ?? 'España',
      statusId: client.value.statusId ?? null,
      originId: client.value.originId ?? null,
      isActive: client.value.isActive,
    };
  }
});

async function save() {
  saving.value = true;
  try {
    await updateMut.mutateAsync({
      id: clientId.value,
      data: {
        name: edit.value.name,
        companyName: edit.value.companyName || undefined,
        nif: edit.value.nif || undefined,
        email: edit.value.email || undefined,
        phone: edit.value.phone || undefined,
        address: edit.value.address || undefined,
        city: edit.value.city || undefined,
        region: edit.value.region || undefined,
        country: edit.value.country || 'España',
        statusId: edit.value.statusId ?? undefined,
        originId: edit.value.originId ?? undefined,
        isActive: edit.value.isActive,
      },
    });
    toast.success(t('ext.crm.clients.updated'));
  } catch (err: unknown) {
    toast.error(t('ext.crm.common.error'), { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

// ─── Convert to affiliate ─────────────────────────────────────────────

const converting = ref(false);

async function convertToAffiliate() {
  if (!client.value?.id) return;
  converting.value = true;
  try {
    const api = useApi();
    await api.post(`/affiliate/partners/from-client/${client.value.id}`, {
      commissionRate: 0.05,
      invite: true,
    });
    toast.success(t('ext.affiliate.partners.convertedOk'));
  } catch (err: unknown) {
    toast.error(t('ext.crm.common.error'), { description: errorMessage(err) });
  } finally {
    converting.value = false;
  }
}

const statusOptions = computed(() =>
  (statuses.value ?? []).map((s) => ({ value: s.id, label: s.label || s.name })),
);

const statusInfo = computed(() => {
  if (!client.value?.status) return null;
  return {
    label: client.value.status.label || client.value.status.name,
    color: client.value.status.color,
  };
});
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <div class="flex items-center gap-3">
          <NuxtLink to="/app/crm/clients" class="btn btn-ghost btn-sm btn-circle">←</NuxtLink>
          <h1 class="text-2xl font-bold">{{ client?.name ?? t('ext.crm.common.loading') }}</h1>
          <span
            v-if="statusInfo"
            class="badge"
            :style="statusInfo.color ? { backgroundColor: `${statusInfo.color}22`, color: statusInfo.color } : undefined"
          >
            {{ statusInfo.label }}
          </span>
          <span v-if="client && !client.isActive" class="badge badge-ghost">✕</span>
        </div>
        <p v-if="client?.companyName" class="text-base-content/60 mt-1 text-sm">{{ client.companyName }}</p>
      </div>
      <button
        class="btn btn-outline btn-sm"
        :disabled="converting || isLoading"
        :title="t('ext.affiliate.partners.fromClientTitle')"
        @click="convertToAffiliate"
      >
        <RefreshCw v-if="converting" class="w-4 h-4 animate-spin" />
        <Handshake v-else class="w-4 h-4" />
        {{ t('ext.affiliate.partners.fromClient') }}
      </button>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else-if="client">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Data form -->
        <div class="card bg-base-100 shadow-sm border border-base-300 lg:col-span-2">
          <div class="card-body">
            <h2 class="card-title text-base">{{ t('ext.crm.clients.data') }}</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <FormInput v-model="edit.name" :label="t('ext.crm.clients.name')" required />
              <FormInput v-model="edit.companyName" :label="t('ext.crm.clients.company')" />
              <FormInput v-model="edit.nif" :label="t('ext.crm.clients.nif')" />
              <FormInput v-model="edit.email" :label="t('ext.crm.clients.email')" type="email" />
              <FormInput v-model="edit.phone" :label="t('ext.crm.clients.phone')" />
              <FormSelect v-model="edit.statusId" :label="t('ext.crm.clients.status')" :options="statusOptions" />
              <FormSelect
                v-model="edit.originId"
                :label="t('ext.crm.clients.origin')"
                :options="(origins ?? []).map((o) => ({ value: o.id, label: o.label || o.name }))"
              />
              <FormInput v-model="edit.address" :label="t('ext.crm.clients.address')" />
              <FormInput v-model="edit.city" :label="t('ext.crm.clients.city')" />
              <FormInput v-model="edit.region" :label="t('ext.crm.clients.region')" />
              <FormInput v-model="edit.country" :label="t('ext.crm.clients.country')" />
              <FormSwitch v-model="edit.isActive" :label="t('ext.crm.clients.active')" />
            </div>
            <div class="card-actions justify-end mt-4">
              <button class="btn btn-primary btn-sm" :disabled="saving" @click="save">
                <span v-if="saving" class="loading loading-spinner loading-xs" />
                {{ t('ext.crm.common.save') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Side info -->
        <div class="space-y-4">
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body">
              <h2 class="card-title text-base">{{ t('ext.crm.dashboard.recentTitle') }}</h2>
              <div class="text-sm space-y-2">
                <div class="flex justify-between">
                  <span class="text-base-content/50">{{ t('ext.crm.clients.origin') }}</span>
                  <span>{{ client?.origin?.label ?? '—' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-base-content/50">{{ t('ext.crm.clients.created') }}</span>
                  <span>{{ client?.createdAt?.slice(0, 10) ?? '—' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contacts + Interactions -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ContactsCard :client-id="Number(clientId)" />
        <InteractionsCard :client-id="Number(clientId)" />
      </div>

      <!-- Projects -->
      <ProjectsCard :client-id="Number(clientId)" />
    </template>
  </div>
</template>