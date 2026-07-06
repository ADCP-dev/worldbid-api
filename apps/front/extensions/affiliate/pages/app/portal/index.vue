<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import type { PortalProfile, PortalSummary, Referral } from '@affiliate/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const affiliate = useAffiliate();
const authStore = useAuthStore();

const loading = ref(false);
const profile = ref<PortalProfile | null>(null);
const summary = ref<PortalSummary | null>(null);
const referrals = ref<Referral[]>([]);

const partnerName = computed(() => profile.value?.name || authStore.user?.firstName || 'Afiliado');

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  contacted: 'Contactado',
  qualified: 'Calificado',
  converted: 'Convertido',
  lost: 'Perdido',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-warning',
  contacted: 'badge-info',
  qualified: 'badge-primary',
  converted: 'badge-success',
  lost: 'badge-error',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount ?? 0);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function loadData() {
  loading.value = true;
  try {
    const [prof, sum, refs] = await Promise.all([
      affiliate.getMyProfile(),
      affiliate.getMySummary(),
      affiliate.getMyReferrals(),
    ]);
    profile.value = prof;
    summary.value = sum;
    const refsList = Array.isArray(refs) ? refs : (refs.data ?? []);
    referrals.value = refsList;
    // Keep only 5 most recent
    referrals.value = referrals.value.slice(0, 5);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    toast.error('Error cargando datos', { description: msg });
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <div class="p-6 space-y-6">
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- Welcome -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">Hola, {{ partnerName }} 👋</h1>
          <p class="text-base-content/60 mt-1">Bienvenido a tu portal de afiliación</p>
        </div>
        <NuxtLink to="/app/portal/referrals/new" class="btn btn-primary btn-sm">
          Nueva referencia
        </NuxtLink>
      </div>

      <!-- Summary -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-title">Pendiente</div>
          <div class="stat-value text-warning">{{ formatCurrency(summary?.pending ?? 0) }}</div>
        </div>
        <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-title">Aprobado</div>
          <div class="stat-value text-info">{{ formatCurrency(summary?.approved ?? 0) }}</div>
        </div>
        <div class="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div class="stat-title">Total pagado</div>
          <div class="stat-value text-success">{{ formatCurrency(summary?.paidTotal ?? 0) }}</div>
        </div>
      </div>

      <!-- Recent referrals -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body p-0">
          <div class="p-4 border-b border-base-300 flex items-center justify-between">
            <h2 class="card-title">Referencias recientes</h2>
            <NuxtLink to="/app/portal/referrals" class="btn btn-ghost btn-xs">Ver todas</NuxtLink>
          </div>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Empresa</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="referrals.length === 0">
                  <td colspan="4" class="text-center text-base-content/40 py-6">Sin referencias</td>
                </tr>
                <tr v-for="r in referrals" :key="r.id">
                  <td class="font-medium">{{ r.clientName || '—' }}</td>
                  <td>{{ r.companyName || '—' }}</td>
                  <td>
                    <span class="badge badge-sm" :class="STATUS_BADGE[r.status]">
                      {{ STATUS_LABELS[r.status] ?? r.status }}
                    </span>
                  </td>
                  <td>{{ formatDate(r.referredDate || r.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>