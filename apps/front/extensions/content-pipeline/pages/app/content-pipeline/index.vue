<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import { FolderKanban, Lightbulb, FileText, CheckCircle } from 'lucide-vue-next';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const cp = useContentPipeline();

const loading = ref(false);
const dashboard = ref<any>(null);

const kpis = computed(() => {
  if (!dashboard.value) return [];
  return [
    {
      label: 'Projects',
      value: dashboard.value.totalProjects ?? 0,
      color: 'text-primary',
      icon: FolderKanban,
    },
    {
      label: 'Ideas',
      value: dashboard.value.totalIdeas ?? 0,
      color: 'text-info',
      icon: Lightbulb,
    },
    {
      label: 'Drafts',
      value: dashboard.value.totalDrafts ?? 0,
      color: 'text-warning',
      icon: FileText,
    },
    {
      label: 'Published',
      value: dashboard.value.totalPublished ?? 0,
      color: 'text-success',
      icon: CheckCircle,
    },
  ];
});

const ideasByStatus = computed(() => dashboard.value?.ideasByStatus ?? []);
const draftsByStatus = computed(() => dashboard.value?.draftsByStatus ?? []);
const recentProjects = computed(() => dashboard.value?.recentProjects ?? []);

async function loadDashboard() {
  loading.value = true;
  try {
    dashboard.value = await cp.getDashboard();
  } catch (err: any) {
    toast.error('Error loading dashboard', { description: err.message });
  } finally {
    loading.value = false;
  }
}

onMounted(loadDashboard);

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Content Pipeline Dashboard</h1>
      <NuxtLink to="/app/content-pipeline/projects/create" class="btn btn-primary btn-sm">
        New Project
      </NuxtLink>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="kpi in kpis"
          :key="kpi.label"
          class="stat bg-base-100 rounded-box shadow-sm border border-base-300"
        >
          <div class="stat-figure" :class="kpi.color">
            <component :is="kpi.icon" class="w-8 h-8" />
          </div>
          <div class="stat-title">{{ kpi.label }}</div>
          <div class="stat-value" :class="kpi.color">{{ kpi.value }}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Ideas by status -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title">Ideas by Status</h2>
            <div v-if="ideasByStatus.length === 0" class="text-sm text-base-content/40">
              No data
            </div>
            <div v-else class="space-y-2">
              <div v-for="item in ideasByStatus" :key="item.status" class="flex items-center gap-3">
                <span class="w-28 text-sm capitalize truncate">{{ item.status }}</span>
                <div class="flex-1 bg-base-200 rounded-full h-6 overflow-hidden">
                  <div
                    class="h-full bg-info rounded-full flex items-center justify-end pr-2 transition-all"
                    :style="{ width: `${Math.min(100, Math.max(8, (item.count / Math.max(...ideasByStatus.map((i: any) => i.count), 1)) * 100))}%` }"
                  >
                    <span class="text-xs text-info-content font-semibold">{{ item.count }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Drafts by status -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title">Drafts by Status</h2>
            <div v-if="draftsByStatus.length === 0" class="text-sm text-base-content/40">
              No data
            </div>
            <div v-else class="space-y-2">
              <div v-for="item in draftsByStatus" :key="item.status" class="flex items-center gap-3">
                <span class="w-28 text-sm capitalize truncate">{{ item.status }}</span>
                <div class="flex-1 bg-base-200 rounded-full h-6 overflow-hidden">
                  <div
                    class="h-full bg-warning rounded-full flex items-center justify-end pr-2 transition-all"
                    :style="{ width: `${Math.min(100, Math.max(8, (item.count / Math.max(...draftsByStatus.map((i: any) => i.count), 1)) * 100))}%` }"
                  >
                    <span class="text-xs text-warning-content font-semibold">{{ item.count }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent projects -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title">Recent Projects</h2>
            <NuxtLink to="/app/content-pipeline/projects" class="btn btn-ghost btn-sm">
              View all
            </NuxtLink>
          </div>
          <div v-if="recentProjects.length === 0" class="text-sm text-base-content/40 py-4">
            No projects yet
          </div>
          <div v-else class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Niche</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="project in recentProjects"
                  :key="project.id"
                  class="hover cursor-pointer"
                  @click="navigateTo(`/app/content-pipeline/projects/${project.id}`)"
                >
                  <td class="font-medium">{{ project.name }}</td>
                  <td>{{ project.niche || '—' }}</td>
                  <td>
                    <span class="badge badge-sm badge-outline capitalize">{{ project.status }}</span>
                  </td>
                  <td>{{ formatDate(project.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>