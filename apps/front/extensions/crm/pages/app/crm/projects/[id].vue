<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  useProjectQuery,
} from '../../../composables/useCrm';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const { t } = useI18n();
const route = useRoute();
const projectId = computed(() => route.params.id as string);

const { data: project, isLoading } = useProjectQuery(projectId);

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(value);
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center gap-3">
      <NuxtLink to="/app/crm/projects" class="btn btn-ghost btn-sm btn-circle">←</NuxtLink>
      <h1 class="text-2xl font-bold">{{ project?.name ?? t('ext.crm.common.loading') }}</h1>
      <span class="badge badge-outline font-mono">#{{ projectId }}</span>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <div v-else-if="project" class="card bg-base-100 shadow-sm border border-base-300 max-w-2xl">
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-base-content/50">{{ t('ext.crm.projects.client') }}</p>
            <NuxtLink :to="`/app/crm/clients/${project.clientId}`" class="link link-primary">
              #{{ project.clientId }}
            </NuxtLink>
          </div>
          <div>
            <p class="text-xs text-base-content/50">{{ t('ext.crm.projects.type') }}</p>
            <p>{{ project.type ? t(`ext.crm.projects.types.${project.type}`, project.type) : '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-base-content/50">{{ t('ext.crm.projects.price') }}</p>
            <p class="tabular-nums">{{ formatCurrency(project.price) }}</p>
          </div>
          <div>
            <p class="text-xs text-base-content/50">{{ t('ext.crm.projects.status') }}</p>
            <p>{{ project.status ? t(`ext.crm.projects.statusOptions.${project.status}`, project.status) : '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-base-content/50">{{ t('ext.crm.projects.paymentStatus') }}</p>
            <p>{{ project.paymentStatus ? t(`ext.crm.projects.paymentOptions.${project.paymentStatus}`, project.paymentStatus) : '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-base-content/50">{{ t('ext.crm.projects.startDate') }}</p>
            <p>{{ project.startDate?.slice(0, 10) || '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-base-content/50">{{ t('ext.crm.projects.endDate') }}</p>
            <p>{{ project.endDate?.slice(0, 10) || '—' }}</p>
          </div>
        </div>
        <div class="card-actions justify-end mt-4">
          <button class="btn btn-ghost btn-sm" @click="navigateTo('/app/crm/projects')">
            {{ t('ext.crm.common.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>