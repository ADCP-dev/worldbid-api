<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const affiliate = useAffiliate();

const loading = ref(false);
const referrals = ref<any[]>([]);

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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function loadReferrals() {
  loading.value = true;
  try {
    const res: any = await affiliate.getMyReferrals();
    referrals.value = res.data ?? res ?? [];
  } catch (err: any) {
    toast.error('Error cargando referencias', { description: err.message });
  } finally {
    loading.value = false;
  }
}

onMounted(loadReferrals);
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Mis referencias</h1>
      <NuxtLink to="/app/portal/referrals/new" class="btn btn-primary btn-sm">
        Nueva referencia
      </NuxtLink>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-0">
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
              <tr v-if="loading">
                <td colspan="4" class="text-center py-8">
                  <span class="loading loading-spinner loading-md text-primary" />
                </td>
              </tr>
              <tr v-else-if="referrals.length === 0">
                <td colspan="4" class="text-center text-base-content/40 py-8">Sin referencias</td>
              </tr>
              <tr v-else v-for="r in referrals" :key="r.id">
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
  </div>
</template>