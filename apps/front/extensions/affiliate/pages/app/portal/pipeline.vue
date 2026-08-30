<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PartnerPipeline from '../../../components/PartnerPipeline.vue';
import { useMyPipelineQuery } from '../../../composables/useAffiliate';

definePageMeta({ layout: 'default', middleware: ['auth', 'affiliate'] });

const { t } = useI18n();
const { data, isLoading } = useMyPipelineQuery();
</script>

<template>
  <div class="p-6 space-y-4">
    <div>
      <h1 class="text-2xl font-bold">{{ t('ext.affiliate.pipeline.title') }}</h1>
      <p class="text-base-content/60 mt-1 text-sm">{{ t('ext.affiliate.pipeline.subtitle') }}</p>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <PartnerPipeline v-else-if="data" :data="data" :loading="isLoading" />
  </div>
</template>