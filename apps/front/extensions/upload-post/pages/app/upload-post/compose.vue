<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { PenLine } from 'lucide-vue-next';
import PageShell from '../../components/PageShell.vue';
import ComposeView from '../../components/composer/ComposeView.vue';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const { t } = useI18n();
</script>

<template>
  <PageShell
    :title="t('ext.upload-post.pages.compose.title')"
    :subtitle="t('ext.upload-post.pages.compose.subtitle')"
    :icon="PenLine"
  >
    <div class="max-w-3xl card bg-base-100 border border-base-300">
      <div class="card-body">
        <ComposeView />
      </div>
    </div>
  </PageShell>
</template>