<script setup lang="ts">
import { computed } from 'vue';
import { toast } from 'vue-sonner';
import { TrendingUp, Repeat, Package, CreditCard } from 'lucide-vue-next';
import { useStripeDashboardQuery } from '@stripe/composables/useStripe';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const { data: dashboard, isLoading, error } = useStripeDashboardQuery();

if (error) {
  toast.error('Error cargando dashboard', { description: error.message });
}

const stats = computed(() => {
  const d = dashboard.value;
  return [
    {
      label: 'MRR',
      value: d?.mrr != null ? `${(d.mrr / 100).toFixed(2)} €` : '—',
      icon: TrendingUp,
      color: 'text-success',
    },
    {
      label: 'Suscripciones activas',
      value: d?.activeSubscriptionsCount ?? 0,
      icon: Repeat,
      color: 'text-primary',
    },
    {
      label: 'Productos',
      value: d?.totalProducts ?? 0,
      icon: Package,
      color: 'text-info',
    },
    {
      label: 'Planes',
      value: d?.totalPlans ?? 0,
      icon: CreditCard,
      color: 'text-warning',
    },
  ];
});

const recentProducts = computed(() => dashboard.value?.recentProducts ?? []);
const recentSubscriptions = computed(
  () => dashboard.value?.recentSubscriptions ?? [],
);

function formatDate(date?: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function statusBadge(status: string): string {
  switch (status) {
    case 'active':
      return 'badge-success';
    case 'canceled':
      return 'badge-error';
    case 'past_due':
      return 'badge-warning';
    case 'trialing':
      return 'badge-info';
    default:
      return 'badge-ghost';
  }
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Stripe Dashboard</h1>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- Stat cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="card bg-base-100 shadow-sm border border-base-300"
        >
          <div class="card-body p-5">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-base-content/60">{{ stat.label }}</p>
                <p class="text-2xl font-bold mt-1">{{ stat.value }}</p>
              </div>
              <component :is="stat.icon" class="w-8 h-8" :class="stat.color" />
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recent products -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <div class="flex items-center justify-between">
              <h2 class="card-title text-base">Productos recientes</h2>
              <NuxtLink to="/app/stripe/products" class="btn btn-ghost btn-sm">
                Ver todos
              </NuxtLink>
            </div>
            <div v-if="recentProducts.length" class="overflow-x-auto mt-3">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Stripe ID</th>
                    <th>Activo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="product in recentProducts" :key="product.id">
                    <td class="font-medium">{{ product.name }}</td>
                    <td class="font-mono text-xs text-base-content/60">
                      {{ product.stripeProductId || '—' }}
                    </td>
                    <td>
                      <span
                        class="badge badge-xs"
                        :class="product.active ? 'badge-success' : 'badge-ghost'"
                      >
                        {{ product.active ? 'Sí' : 'No' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-sm text-base-content/60 py-6 text-center">
              Sin productos recientes
            </p>
          </div>
        </div>

        <!-- Recent subscriptions -->
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <div class="flex items-center justify-between">
              <h2 class="card-title text-base">Suscripciones recientes</h2>
              <NuxtLink to="/app/stripe/subscriptions" class="btn btn-ghost btn-sm">
                Ver todas
              </NuxtLink>
            </div>
            <div v-if="recentSubscriptions.length" class="overflow-x-auto mt-3">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Plan</th>
                    <th>Estado</th>
                    <th>Renovación</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="sub in recentSubscriptions" :key="sub.id">
                    <td class="text-sm">{{ sub.customerEmail || '—' }}</td>
                    <td class="text-sm">{{ sub.plan?.name || '—' }}</td>
                    <td>
                      <span class="badge badge-xs" :class="statusBadge(sub.status)">
                        {{ sub.status }}
                      </span>
                    </td>
                    <td class="text-xs text-base-content/60">
                      {{ formatDate(sub.currentPeriodEnd) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-sm text-base-content/60 py-6 text-center">
              Sin suscripciones recientes
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>