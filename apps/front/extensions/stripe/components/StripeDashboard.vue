<script setup lang="ts">
import { computed } from 'vue';
import { toast } from 'vue-sonner';
import { DollarSign, Users, Package, Layers, ArrowRight } from 'lucide-vue-next';
import type { StripeDashboardData, Subscription, Product } from '../types';

const { data, isLoading, error } = useStripeDashboardQuery();

const dashboard = computed<StripeDashboardData | null>(() => {
  const raw = data.value as unknown;
  if (!raw || typeof raw !== 'object') return null;
  return raw as StripeDashboardData;
});

const mrr = computed(() => dashboard.value?.mrr ?? 0);
const activeSubscriptions = computed(() => dashboard.value?.activeSubscriptionsCount ?? 0);
const totalProducts = computed(() => dashboard.value?.totalProducts ?? 0);
const totalPlans = computed(() => dashboard.value?.totalPlans ?? 0);
const recentSubscriptions = computed<Subscription[]>(() => dashboard.value?.recentSubscriptions ?? []);
const recentProducts = computed<Product[]>(() => dashboard.value?.recentProducts ?? []);

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Surface query errors via toast (once)
watch(error, (err) => {
  if (!err) return;
  const msg = err instanceof Error ? err.message : String(err);
  toast.error('Error cargando dashboard Billing', { description: msg });
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold">Billing Dashboard</h2>
      <NuxtLink to="/app/stripe" class="btn btn-primary btn-sm">
        Gestionar billing
      </NuxtLink>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-figure text-primary">
            <DollarSign class="w-6 h-6" />
          </div>
          <div class="stat-title">MRR</div>
          <div class="stat-value text-primary">{{ formatCurrency(mrr) }}</div>
        </div>
        <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-figure text-success">
            <Users class="w-6 h-6" />
          </div>
          <div class="stat-title">Suscripciones activas</div>
          <div class="stat-value text-success">{{ activeSubscriptions }}</div>
        </div>
        <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-figure text-info">
            <Package class="w-6 h-6" />
          </div>
          <div class="stat-title">Productos totales</div>
          <div class="stat-value text-info">{{ totalProducts }}</div>
        </div>
        <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-figure text-warning">
            <Layers class="w-6 h-6" />
          </div>
          <div class="stat-title">Planes totales</div>
          <div class="stat-value text-warning">{{ totalPlans }}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recent subscriptions -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h3 class="card-title">Suscripciones recientes</h3>
            <div v-if="recentSubscriptions.length === 0" class="text-sm text-base-content/40">
              Sin suscripciones
            </div>
            <ul v-else class="divide-y divide-base-200">
              <li
                v-for="sub in recentSubscriptions"
                :key="sub.id"
                class="flex items-center justify-between py-2"
              >
                <div class="min-w-0">
                  <div class="text-sm font-medium truncate">
                    {{ sub.customerEmail || sub.customerId || sub.id }}
                  </div>
                  <div class="text-xs text-base-content/60">
                    {{ sub.plan?.name ?? 'Sin plan' }} · {{ formatDate(sub.createdAt) }}
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="badge badge-sm capitalize">{{ sub.status }}</span>
                  <NuxtLink to="/app/stripe/subscriptions" class="btn btn-ghost btn-xs">
                    <ArrowRight class="w-3 h-3" />
                  </NuxtLink>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <!-- Recent products -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h3 class="card-title">Productos recientes</h3>
            <div v-if="recentProducts.length === 0" class="text-sm text-base-content/40">
              Sin productos
            </div>
            <ul v-else class="divide-y divide-base-200">
              <li
                v-for="product in recentProducts"
                :key="product.id"
                class="flex items-center justify-between py-2"
              >
                <div class="min-w-0">
                  <div class="text-sm font-medium truncate">{{ product.name }}</div>
                  <div class="text-xs text-base-content/60">
                    {{ product.prices?.length ?? 0 }} precios · {{ formatDate(product.createdAt) }}
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span
                    class="badge badge-sm"
                    :class="product.active ? 'badge-success' : 'badge-ghost'"
                  >
                    {{ product.active ? 'Activo' : 'Inactivo' }}
                  </span>
                  <NuxtLink to="/app/stripe/products" class="btn btn-ghost btn-xs">
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