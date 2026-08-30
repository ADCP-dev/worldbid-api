<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { LayoutDashboard } from 'lucide-vue-next';
import PageShell from '@upload-post/components/PageShell.vue';
import ComposeView from '@upload-post/components/composer/ComposeView.vue';
import { useLocalPostsQuery, type UpPostRecord } from '@upload-post/composables/useUploadPostApi';

const { t } = useI18n();

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const activeTab = ref<'compose' | 'history'>('compose');

const localQuery = useLocalPostsQuery();
const poll = ref<ReturnType<typeof setInterval> | null>(null);

onMounted(() => {
  poll.value = setInterval(() => localQuery.refetch(), 8000);
});
onBeforeUnmount(() => {
  if (poll.value) clearInterval(poll.value);
});

const posts = computed<UpPostRecord[]>(
  () => (localQuery.data.value ?? []) as UpPostRecord[],
);

interface Row {
  id: string;
  created: string;
  media: string;
  platforms: string;
  status: string;
  statusClass: string;
  error: string | null;
  requestId: string | null;
  results: string;
}

function statusClass(s: string): string {
  if (s === 'success') return 'badge-success';
  if (s === 'error') return 'badge-error';
  if (s === 'processing') return 'badge-warning';
  return 'badge-ghost';
}

function serializeResults(
  results: Record<string, unknown> | null | undefined,
): string {
  return Object.entries(results ?? {})
    .map(
      ([k, v]: [string, unknown]) =>
        `${k}:${typeof v === 'object' && v !== null && (v as { success?: boolean }).success === true ? 'ok' : 'fail'}`,
    )
    .join(', ');
}

const rows = computed<Row[]>(() =>
  posts.value.map((p) => ({
    id: p.id,
    created: new Date(p.createdAt).toLocaleString(),
    media: p.mediaType,
    platforms: (p.platforms ?? []).join(', '),
    status: p.status,
    statusClass: statusClass(p.status),
    error: p.errorMessage ?? null,
    requestId: p.requestId ?? null,
    results: serializeResults(p.platformResults),
  })),
);
</script>

<template>
  <PageShell
    :title="t('ext.upload-post.pages.index.title')"
    :subtitle="t('ext.upload-post.pages.index.subtitle')"
    :icon="LayoutDashboard"
    :loading="localQuery.isLoading.value"
  >
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div role="tablist" class="tabs tabs-box">
          <button
            role="tab"
            class="tab"
            :class="activeTab === 'compose' ? 'tab-active' : ''"
            @click="activeTab = 'compose'"
          >
            {{ t('ext.upload-post.pages.index.composeTab') }}
          </button>
          <button
            role="tab"
            class="tab"
            :class="activeTab === 'history' ? 'tab-active' : ''"
            @click="activeTab = 'history'"
          >
            {{ t('ext.upload-post.pages.index.historyTab') }}
          </button>
        </div>
        <NuxtLink to="/app/upload-post/compose" class="btn btn-primary btn-sm">
          {{ t('ext.upload-post.pages.index.openComposer') }}
        </NuxtLink>
      </div>

      <div v-show="activeTab === 'compose'" class="card bg-base-100 border border-base-300">
        <div class="card-body">
          <ComposeView />
        </div>
      </div>

      <div v-show="activeTab === 'history'" class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>{{ t('ext.upload-post.history.date') }}</th>
              <th>{{ t('ext.upload-post.history.media') }}</th>
              <th>{{ t('ext.upload-post.history.platforms') }}</th>
              <th>{{ t('ext.upload-post.history.status') }}</th>
              <th>{{ t('ext.upload-post.history.results') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td class="whitespace-nowrap">{{ row.created }}</td>
              <td>{{ t(`ext.upload-post.composer.mediaTypes.${row.media}`) }}</td>
              <td>{{ row.platforms }}</td>
              <td>
                <span class="badge badge-sm" :class="row.statusClass">
                  {{ row.status }}
                </span>
              </td>
              <td class="max-w-xs truncate text-xs" :title="row.error ?? row.results">
                {{ row.error ?? (row.results || '—') }}
              </td>
            </tr>
          </tbody>
          <tbody v-if="rows.length === 0">
            <tr>
              <td colspan="5" class="text-center text-base-content/50 py-8">
                {{ t('ext.upload-post.common.noData') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </PageShell>
</template>