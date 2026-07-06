<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import { Calendar, TrendingUp, Share2, Clock, ArrowRight } from 'lucide-vue-next';

const uploadPost = useUploadPost();

const loading = ref(true);
const weeklyReport = ref<{
  totalImpressions: number;
  topPlatform: string;
  platforms: Array<{
    platform: string;
    followers: number;
    reach: number;
    views: number;
    likes: number;
  }>;
} | null>(null);
const scheduled = ref<Array<{
  job_id: string;
  scheduled_date: string;
  title?: string;
  caption?: string;
  platforms?: string[];
  status?: string;
}>>([]);

const postsThisWeek = computed(() => {
  if (!weeklyReport.value) return 0;
  const platforms = weeklyReport.value.platforms ?? [];
  return platforms.reduce((sum, p) => sum + (p.views ?? 0) > 0 ? 1 : 0, 0);
});

const totalImpressions = computed(() => weeklyReport.value?.totalImpressions ?? 0);

const platformBreakdown = computed(() => weeklyReport.value?.platforms ?? []);

const recentScheduled = computed(() =>
  [...scheduled.value]
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
    .slice(0, 6),
);

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(async () => {
  loading.value = true;
  try {
    const [report, sched] = await Promise.all([
      uploadPost.getWeeklyReport().catch(() => null),
      uploadPost.getScheduled().catch(() => ({ posts: [] })),
    ]);
    weeklyReport.value = report as typeof weeklyReport.value;
    scheduled.value = (sched as { posts: typeof scheduled.value })?.posts ?? [];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    toast.error('Error cargando dashboard Social Media', { description: msg });
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold">Social Media Dashboard</h2>
      <NuxtLink to="/app/upload-post" class="btn btn-primary btn-sm">
        Gestionar publicaciones
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-figure text-primary">
            <Calendar class="w-6 h-6" />
          </div>
          <div class="stat-title">Posts esta semana</div>
          <div class="stat-value text-primary">{{ postsThisWeek }}</div>
        </div>
        <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-figure text-info">
            <TrendingUp class="w-6 h-6" />
          </div>
          <div class="stat-title">Impresiones totales</div>
          <div class="stat-value text-info">{{ totalImpressions.toLocaleString('es-ES') }}</div>
        </div>
        <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-figure text-success">
            <Share2 class="w-6 h-6" />
          </div>
          <div class="stat-title">Top plataforma</div>
          <div class="stat-value text-success capitalize">{{ weeklyReport?.topPlatform ?? '—' }}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Platform breakdown -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h3 class="card-title">Desglose por plataforma</h3>
            <div v-if="platformBreakdown.length === 0" class="text-sm text-base-content/40">
              Sin datos
            </div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                v-for="platform in platformBreakdown"
                :key="platform.platform"
                class="card card-compact bg-base-200"
              >
                <div class="card-body">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium capitalize">{{ platform.platform }}</span>
                  </div>
                  <div class="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div class="text-base-content/60">Followers</div>
                      <div class="font-semibold">{{ (platform.followers ?? 0).toLocaleString('es-ES') }}</div>
                    </div>
                    <div>
                      <div class="text-base-content/60">Reach</div>
                      <div class="font-semibold">{{ (platform.reach ?? 0).toLocaleString('es-ES') }}</div>
                    </div>
                    <div>
                      <div class="text-base-content/60">Views</div>
                      <div class="font-semibold">{{ (platform.views ?? 0).toLocaleString('es-ES') }}</div>
                    </div>
                    <div>
                      <div class="text-base-content/60">Likes</div>
                      <div class="font-semibold">{{ (platform.likes ?? 0).toLocaleString('es-ES') }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent scheduled posts -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h3 class="card-title">
              <Clock class="w-5 h-5" />
              Posts programados
            </h3>
            <div v-if="recentScheduled.length === 0" class="text-sm text-base-content/40">
              Sin posts programados
            </div>
            <ul v-else class="divide-y divide-base-200">
              <li
                v-for="item in recentScheduled"
                :key="item.job_id"
                class="flex items-center justify-between py-2"
              >
                <div class="min-w-0">
                  <div class="text-sm font-medium truncate">
                    {{ item.title || item.caption || 'Sin título' }}
                  </div>
                  <div class="text-xs text-base-content/60">
                    {{ formatDate(item.scheduled_date) }}
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <div v-if="item.platforms?.length" class="flex gap-1">
                    <span
                      v-for="p in item.platforms"
                      :key="p"
                      class="badge badge-sm badge-outline capitalize"
                    >
                      {{ p }}
                    </span>
                  </div>
                  <span
                    v-if="item.status"
                    class="badge badge-sm badge-ghost"
                  >
                    {{ item.status }}
                  </span>
                  <NuxtLink to="/app/upload-post/queue" class="btn btn-ghost btn-xs">
                    <ArrowRight class="w-3 h-3" />
                  </NuxtLink>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>