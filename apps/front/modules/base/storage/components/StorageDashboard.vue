<script setup lang="ts">
import { File, HardDrive, Image, FileText } from 'lucide-vue-next';
import FileTypeIcon from './FileTypeIcon.vue';
import type { FileStats } from '../types';

interface Props {
  stats?: FileStats;
  loading?: boolean;
  quota?: number;
}

const props = withDefaults(defineProps<Props>(), {
  quota: 10737418240, // 10 GB default
});

const STORAGE_PRICE_PER_GB = 0.005; // Backblaze B2: $0.005/GB/month (approx 0.0046€)

const formatSize = (bytes?: number) => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
};

const usagePercent = computed(() => {
  if (!props.stats?.totalSize || !props.quota) return 0;
  return Math.min(100, Math.round((props.stats.totalSize / props.quota) * 100));
});

const estimatedPrice = computed(() => {
  const bytes = props.stats?.totalSize ?? 0;
  const gb = bytes / (1024 * 1024 * 1024);
  return (gb * STORAGE_PRICE_PER_GB).toFixed(6);
});

const imageCount = computed(() => {
  return props.stats?.byType?.find(t => t.type === 'image')?.count || 0;
});

const documentCount = computed(() => {
  return props.stats?.byType?.find(t => t.type === 'document')?.count || 0;
});

const timeAgo = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
};
</script>

<template>
  <div class="card bg-base-100 shadow-sm border">
    <div class="card-body">
      <h2 class="card-title text-lg mb-4">Resumen de Almacenamiento</h2>

      <div v-if="loading" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-lg text-primary" />
      </div>

      <template v-else-if="stats">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <!-- Total Files -->
          <div class="card bg-base-200">
            <div class="card-body p-4">
              <div class="stat">
                <div class="stat-figure text-primary">
                  <File class="w-6 h-6" />
                </div>
                <div class="stat-title text-sm">Archivos</div>
                <div class="stat-value text-2xl">{{ stats.totalFiles ?? 0 }}</div>
              </div>
            </div>
          </div>

          <!-- Used Space -->
          <div class="card bg-base-200">
            <div class="card-body p-4">
              <div class="stat">
                <div class="stat-figure text-secondary">
                  <HardDrive class="w-6 h-6" />
                </div>
                <div class="stat-title text-sm">Espacio usado</div>
                <div class="stat-value text-2xl">{{ formatSize(stats.totalSize) }}</div>
              </div>
            </div>
          </div>

          <!-- Images -->
          <div class="card bg-base-200">
            <div class="card-body p-4">
              <div class="stat">
                <div class="stat-figure text-accent">
                  <Image class="w-6 h-6" />
                </div>
                <div class="stat-title text-sm">Imágenes</div>
                <div class="stat-value text-2xl">{{ imageCount }}</div>
              </div>
            </div>
          </div>

          <!-- Documents -->
          <div class="card bg-base-200">
            <div class="card-body p-4">
              <div class="stat">
                <div class="stat-figure text-info">
                  <FileText class="w-6 h-6" />
                </div>
                <div class="stat-title text-sm">Documentos</div>
                <div class="stat-value text-2xl">{{ documentCount }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Usage Bar -->
        <div class="mb-6">
          <div class="flex justify-between text-sm mb-2">
            <span>Uso del almacenamiento</span>
            <span>{{ usagePercent }}%</span>
          </div>
          <progress
            class="progress progress-primary w-full"
            :value="usagePercent"
            max="100"
          />
          <div class="flex justify-between text-xs text-base-content/60 mt-1">
            <span>{{ formatSize(stats.totalSize) }}</span>
            <span>{{ formatSize(quota) }}</span>
          </div>
        </div>

        <!-- Price Estimate -->
        <div class="card bg-info/10 border border-info/30 mb-6">
          <div class="card-body p-4">
            <div class="flex items-center gap-2">
              <span class="text-lg font-bold">€{{ estimatedPrice }}</span>
              <span class="text-sm text-base-content/60">/mes estimado</span>
            </div>
            <p class="text-xs text-base-content/50">{{ formatSize(stats?.totalSize) }} usados · Backblaze B2 (~$0.005/GB/mes)</p>
          </div>
        </div>

        <!-- Recent Files -->
        <div>
          <h3 class="font-semibold mb-3">Archivos recientes</h3>
          <div class="space-y-2">
            <div
              v-for="file in (stats.recentFiles?.slice(0, 5) ?? [])"
              :key="file.id"
              class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200 transition-colors"
            >
              <FileTypeIcon :mime-type="file.type" size="sm" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ file.name }}</p>
                <p class="text-xs text-base-content/60">{{ timeAgo(file.createdAt) }}</p>
              </div>
              <span class="text-xs text-base-content/60">{{ formatSize(file.size) }}</span>
            </div>
            <p v-if="!stats.recentFiles?.length" class="text-sm text-base-content/60 text-center py-4">
              No hay archivos recientes
            </p>
          </div>
        </div>
      </template>

      <div v-else class="text-center py-8 text-base-content/60">
        No se pudieron cargar las estadísticas
      </div>
    </div>
  </div>
</template>
