<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const {
  getMonthlySummary,
  getMonthlyHistory,
  getTopPostsByMonth,
} = useUploadPost();

// ─── State ──────────────────────────────────────────────────────────────

const loading = ref(false);
const historyLoading = ref(false);

const now = new Date();
const currentMonth = ref(
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
);

const summary = ref<any>(null);
const history = ref<any[]>([]);
const topPosts = ref<any[]>([]);

const monthOptions = computed(() => {
  const opts: { label: string; value: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    opts.push({
      label: d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
      value: val,
    });
  }
  return opts;
});

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

// ─── Load ────────────────────────────────────────────────────────────────

async function loadSummary() {
  loading.value = true;
  try {
    const [s, posts] = await Promise.all([
      getMonthlySummary(currentMonth.value),
      getTopPostsByMonth(currentMonth.value, 20),
    ]);
    summary.value = s;
    topPosts.value = Array.isArray(posts) ? posts : [];
  } catch (err: unknown) {
    toast.error('Error cargando resumen', { description: err instanceof Error ? err.message : 'Error' });
  } finally {
    loading.value = false;
  }
}

async function loadHistory() {
  historyLoading.value = true;
  try {
    history.value = await getMonthlyHistory(12);
  } catch (err: unknown) {
    toast.error('Error cargando histórico', { description: err instanceof Error ? err.message : 'Error' });
  } finally {
    historyLoading.value = false;
  }
}

onMounted(() => {
  loadSummary();
  loadHistory();
});

watch(currentMonth, loadSummary);

function formatNum(n: number | undefined): string {
  if (!n) return '0';
  return n.toLocaleString();
}

function formatMonth(val: string): string {
  const [y, m] = val.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
}

// Max value for history chart bars
const maxImpressions = computed(() =>
  Math.max(...history.value.map((h) => h.totalImpressions ?? 0), 1),
);

const maxFollowersGrowth = computed(() =>
  Math.max(...history.value.map((h) => Math.abs(h.followersGrowth ?? 0)), 1),
);
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between px-4 py-3 border-b border-base-300">
      <h1 class="text-xl font-bold">Analytics Mensual</h1>
      <select v-model="currentMonth" class="select select-sm select-bordered">
        <option v-for="opt in monthOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>

    <div class="flex-1 overflow-auto p-4 space-y-6">
      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary" />
      </div>

      <template v-else>
        <!-- Monthly Summary Cards -->
        <div v-if="summary && summary.platforms.length" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="p in summary.platforms"
            :key="p.platform"
            class="card bg-base-100 shadow border border-base-300"
          >
            <div class="card-body">
              <h3 class="card-title">{{ PLATFORM_LABELS[p.platform] ?? p.platform }}</h3>
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span class="text-base-content/60">Followers</span>
                  <p class="font-bold text-lg">{{ formatNum(p.followersEnd) }}</p>
                  <span
                    class="badge badge-sm"
                    :class="p.followersDelta >= 0 ? 'badge-success' : 'badge-error'"
                  >
                    {{ p.followersDelta >= 0 ? '+' : '' }}{{ formatNum(p.followersDelta) }}
                  </span>
                </div>
                <div>
                  <span class="text-base-content/60">Mejor día</span>
                  <p class="text-xs font-medium">{{ p.bestDay?.date ?? '—' }}</p>
                  <p class="text-xs">{{ formatNum(p.bestDay?.reach) }} reach</p>
                </div>
                <div>
                  <span class="text-base-content/60">Reach total</span>
                  <p class="font-bold">{{ formatNum(p.totalReach) }}</p>
                </div>
                <div>
                  <span class="text-base-content/60">Views total</span>
                  <p class="font-bold">{{ formatNum(p.totalViews) }}</p>
                </div>
                <div>
                  <span class="text-base-content/60">Likes</span>
                  <p class="font-bold">{{ formatNum(p.totalLikes) }}</p>
                </div>
                <div>
                  <span class="text-base-content/60">Comments</span>
                  <p class="font-bold">{{ formatNum(p.totalComments) }}</p>
                </div>
                <div>
                  <span class="text-base-content/60">Shares</span>
                  <p class="font-bold">{{ formatNum(p.totalShares) }}</p>
                </div>
                <div>
                  <span class="text-base-content/60">Saves</span>
                  <p class="font-bold">{{ formatNum(p.totalSaves) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8 text-base-content/50">
          Sin datos para {{ formatMonth(currentMonth) }}
        </div>

        <!-- Monthly Totals -->
        <div v-if="summary && summary.platforms.length" class="stats shadow w-full">
          <div class="stat">
            <div class="stat-title">Impresiones totales</div>
            <div class="stat-value text-2xl">{{ formatNum(summary.totalImpressions) }}</div>
          </div>
          <div class="stat">
            <div class="stat-title">Crecimiento followers</div>
            <div class="stat-value text-2xl" :class="summary.totalFollowersGrowth >= 0 ? 'text-success' : 'text-error'">
              {{ summary.totalFollowersGrowth >= 0 ? '+' : '' }}{{ formatNum(summary.totalFollowersGrowth) }}
            </div>
          </div>
        </div>

        <!-- 12-Month History Chart -->
        <div class="card bg-base-100 shadow border border-base-300">
          <div class="card-body">
            <h3 class="card-title text-base">Histórico 12 meses</h3>

            <div v-if="historyLoading" class="flex justify-center py-4">
              <span class="loading loading-spinner loading-md" />
            </div>

            <div v-else-if="history.length" class="space-y-3 mt-4">
              <!-- Impressions bars -->
              <div>
                <p class="text-xs text-base-content/60 mb-1">Impresiones por mes</p>
                <div class="flex items-end gap-1 h-32">
                  <div
                    v-for="h in history"
                    :key="h.month"
                    class="flex-1 flex flex-col items-center gap-1 group"
                  >
                    <div class="text-xs opacity-0 group-hover:opacity-100 transition-opacity">{{ formatNum(h.totalImpressions) }}</div>
                    <div
                      class="w-full bg-primary rounded-t transition-all group-hover:bg-primary-focus"
                      :style="{ height: `${(h.totalImpressions / maxImpressions) * 100}%` }"
                    />
                    <div class="text-xs text-base-content/50">{{ formatMonth(h.month) }}</div>
                  </div>
                </div>
              </div>

              <!-- Followers growth bars -->
              <div>
                <p class="text-xs text-base-content/60 mb-1">Crecimiento de followers por mes</p>
                <div class="flex items-end gap-1 h-24">
                  <div
                    v-for="h in history"
                    :key="h.month"
                    class="flex-1 flex flex-col items-center gap-1 group"
                  >
                    <div
                      class="w-full rounded-t transition-all group-hover:opacity-80"
                      :class="h.followersGrowth >= 0 ? 'bg-success' : 'bg-error'"
                      :style="{ height: `${(Math.abs(h.followersGrowth) / maxFollowersGrowth) * 100}%` }"
                    />
                    <div class="text-xs text-base-content/50">{{ formatMonth(h.month) }}</div>
                  </div>
                </div>
              </div>

              <!-- Per-platform breakdown table -->
              <div class="overflow-x-auto mt-4">
                <table class="table table-xs">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th>Plataforma</th>
                      <th>Followers</th>
                      <th>Reach</th>
                      <th>Views</th>
                      <th>Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-for="h in history" :key="h.month">
                      <tr v-for="(p, i) in h.platforms" :key="`${h.month}-${p.platform}`">
                        <td v-if="i === 0" :rowspan="h.platforms.length" class="font-medium">{{ formatMonth(h.month) }}</td>
                        <td>{{ PLATFORM_LABELS[p.platform] ?? p.platform }}</td>
                        <td>{{ formatNum(p.followers) }}</td>
                        <td>{{ formatNum(p.reach) }}</td>
                        <td>{{ formatNum(p.views) }}</td>
                        <td>{{ formatNum(p.engagement) }}</td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-else class="text-center py-4 text-base-content/50">
              Sin histórico disponible
            </div>
          </div>
        </div>

        <!-- Top Posts -->
        <div v-if="topPosts.length" class="card bg-base-100 shadow border border-base-300">
          <div class="card-body">
            <h3 class="card-title text-base">Posts publicados — {{ formatMonth(currentMonth) }}</h3>
            <div class="overflow-x-auto mt-2">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Plataformas</th>
                    <th>Estado</th>
                    <th>Publicado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="post in topPosts" :key="post.id">
                    <td class="max-w-xs truncate">{{ post.title || '—' }}</td>
                    <td>
                      <span v-for="p in post.platforms" :key="p" class="badge badge-xs badge-outline mr-1">{{ p }}</span>
                    </td>
                    <td>
                      <span class="badge badge-sm badge-success">{{ post.status }}</span>
                    </td>
                    <td class="text-sm">{{ post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>