<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { PenLine, BarChart3, Inbox, Lightbulb } from 'lucide-vue-next';
import PageShell from '../components/PageShell.vue';

const { t } = useI18n();

const quickLinks = [
  {
    to: '/app/upload-post/compose',
    icon: PenLine,
    titleKey: 'ext.upload-post.widget.composeTitle',
    descKey: 'ext.upload-post.widget.composeDesc',
  },
  {
    to: '/app/upload-post/analytics',
    icon: BarChart3,
    titleKey: 'ext.upload-post.widget.analyticsTitle',
    descKey: 'ext.upload-post.widget.analyticsDesc',
  },
  {
    to: '/app/upload-post/inbox',
    icon: Inbox,
    titleKey: 'ext.upload-post.widget.inboxTitle',
    descKey: 'ext.upload-post.widget.inboxDesc',
  },
  {
    to: '/app/upload-post/ideas',
    icon: Lightbulb,
    titleKey: 'ext.upload-post.widget.ideasTitle',
    descKey: 'ext.upload-post.widget.ideasDesc',
  },
] as const;
</script>

<template>
  <PageShell
    :title="t('ext.upload-post.widget.dashboardTitle')"
    :subtitle="t('ext.upload-post.widget.subtitle')"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <NuxtLink
        v-for="link in quickLinks"
        :key="link.to"
        :to="link.to"
        class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-colors"
      >
        <div class="card-body flex-row items-center gap-4">
          <div class="rounded-lg bg-primary/10 p-3 text-primary">
            <component :is="link.icon" class="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h3 class="font-semibold">{{ t(link.titleKey) }}</h3>
            <p class="text-sm text-base-content/60">
              {{ t(link.descKey) }}
            </p>
          </div>
        </div>
      </NuxtLink>
    </div>
  </PageShell>
</template>