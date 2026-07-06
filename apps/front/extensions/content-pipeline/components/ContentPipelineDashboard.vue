<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import {
  FolderKanban,
  Lightbulb,
  FileText,
  Send,
} from 'lucide-vue-next';

const cp = useContentPipeline();

const loading = ref(false);
const dashboard = ref<any>(null);

const kpis = computed(() => {
  const d = dashboard.value;
  return [
    {
      label: 'Projects',
      value: d?.totalProjects ?? 0,
      color: 'text-primary',
      icon: FolderKanban,
    },
    {
      label: 'Ideas',
      value: d?.totalIdeas ?? 0,
      color: 'text-info',
      icon: Lightbulb,
    },
    {
      label: 'Drafts',
      value: d?.totalDrafts ?? 0,
      color: 'text-warning',
      icon: FileText,
    },
    {
      label: 'Published',
      value: d?.publishedDrafts ?? 0,
      color: 'text-success',
      icon: Send,
    },
  ];
});

async function loadDashboard() {
  loading.value = true;
  try {
    const data = await cp.getDashboard();
    dashboard.value = data;
  } catch (err: any) {
    toast.error('Error loading content pipeline dashboard', {
      description: err.message,
    });
  } finally {
    loading.value = false;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Content Pipeline</h1>
      <NuxtLink to="/app/content-pipeline" class="btn btn-primary btn-sm">
        Manage
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- KPI stat cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="kpi in kpis"
          :key="kpi.label"
          class="stat bg-base-100 rounded-box shadow-sm border border-base-300"
        >
          <div class="stat-figure" :class="kpi.color">
            <component :is="kpi.icon" class="w-6 h-6" />
          </div>
          <div class="stat-title">{{ kpi.label }}</div>
          <div class="stat-value" :class="kpi.color">{{ kpi.value }}</div>
        </div>
      </div>
    </template>
  </div>
</template>