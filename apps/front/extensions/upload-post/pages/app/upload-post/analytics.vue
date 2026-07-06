<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import { format } from 'date-fns';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const { getAnalytics, getWeeklyReport, sendWeeklyReport } = useUploadPost();

const loading = ref(false);
const analytics = ref<Record<string, any>>({});
const report = ref<any>(null);
const reportLoading = ref(false);

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  x: 'X (Twitter)',
  threads: 'Threads',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  bluesky: 'Bluesky',
};

const platforms = computed(() => {
  return Object.entries(analytics.value)
    .filter(([key]) => key !== 'success' && key !== 'message')
    .map(([key, data]) => ({
      key,
      label: PLATFORM_LABELS[key] ?? key,
      ...data,
    }))
    .sort((a, b) => (b.reach ?? 0) + (b.views ?? 0) - ((a.reach ?? 0) + (a.views ?? 0)));
});

async function loadAnalytics() {
  loading.value = true;
  try {
    const username = 'som-os';
    analytics.value = await getAnalytics(username);
  } catch (err: unknown) {
    toast.error('Error cargando analytics', { description: err instanceof Error ? err.message : 'Error' });
  } finally {
    loading.value = false;
  }
}

async function loadReport() {
  reportLoading.value = true;
  try {
    report.value = await getWeeklyReport();
  } catch (err: unknown) {
    toast.error('Error generando reporte', { description: err instanceof Error ? err.message : 'Error' });
  } finally {
    reportLoading.value = false;
  }
}

async function handleSendReport() {
  try {
    await sendWeeklyReport();
    toast.success('Reporte semanal enviado por email');
  } catch (err: unknown) {
    toast.error('Error enviando reporte', { description: err instanceof Error ? err.message : 'Error' });
  }
}

onMounted(loadAnalytics);

function formatNum(n: number | undefined): string {
  if (!n) return '0';
  return n.toLocaleString();
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between px-4 py-3 border-b border-base-300">
      <h1 class="text-xl font-bold">Social Media — Analytics</h1>
      <div class="flex gap-2">
        <button class="btn btn-ghost btn-sm" @click="loadAnalytics">
          <span v-if="loading" class="loading loading-spinner loading-xs" />
          Actualizar
        </button>
        <button class="btn btn-primary btn-sm" @click="handleSendReport">
          Enviar reporte semanal
        </button>
      </div>
    </div>

    <div class="flex-1 p-4 overflow-auto">
      <!-- Weekly report summary -->
      <div v-if="report" class="card bg-base-100 shadow mb-6">
        <div class="card-body">
          <h2 class="card-title">Reporte semanal</h2>
          <p class="text-sm text-base-content/70">
            {{ report.period.start }} → {{ report.period.end }} ·
            Impresiones totales: {{ formatNum(report.totalImpressions) }} ·
            Plataforma destacada: {{ report.topPlatform }}
          </p>
        </div>
      </div>

      <!-- Platform cards -->
      <div v-if="loading" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary" />
      </div>

      <div v-else-if="platforms.length === 0" class="text-center py-12 text-base-content/50">
        No hay datos de analytics disponibles
      </div>

      <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="p in platforms"
          :key="p.key"
          class="card bg-base-100 shadow border border-base-300"
        >
          <div class="card-body">
            <h3 class="card-title">{{ p.label }}</h3>

            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span class="text-base-content/60">Followers</span>
                <p class="font-bold text-lg">{{ formatNum(p.followers) }}</p>
              </div>
              <div>
                <span class="text-base-content/60">Reach</span>
                <p class="font-bold text-lg">{{ formatNum(p.reach) }}</p>
              </div>
              <div>
                <span class="text-base-content/60">Views</span>
                <p class="font-bold">{{ formatNum(p.views) }}</p>
              </div>
              <div>
                <span class="text-base-content/60">Likes</span>
                <p class="font-bold">{{ formatNum(p.likes) }}</p>
              </div>
              <div>
                <span class="text-base-content/60">Comments</span>
                <p class="font-bold">{{ formatNum(p.comments) }}</p>
              </div>
              <div>
                <span class="text-base-content/60">Shares</span>
                <p class="font-bold">{{ formatNum(p.shares) }}</p>
              </div>
              <div>
                <span class="text-base-content/60">Saves</span>
                <p class="font-bold">{{ formatNum(p.saves) }}</p>
              </div>
              <div>
                <span class="text-base-content/60">Profile views</span>
                <p class="font-bold">{{ formatNum(p.profileViews) }}</p>
              </div>
            </div>

            <!-- Weekly delta -->
            <div v-if="p.followersDelta !== undefined" class="mt-2">
              <span
                class="badge"
                :class="p.followersDelta >= 0 ? 'badge-success' : 'badge-error'"
              >
                {{ p.followersDelta >= 0 ? '+' : '' }}{{ formatNum(p.followersDelta) }} followers
              </span>
            </div>
          </div>
        </div>
      </div>

      <button class="btn btn-ghost btn-sm mt-4" @click="loadReport">
        <span v-if="reportLoading" class="loading loading-spinner loading-xs" />
        Generar reporte semanal
      </button>
    </div>
  </div>
</template>