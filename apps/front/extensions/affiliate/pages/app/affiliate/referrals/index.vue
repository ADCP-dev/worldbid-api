<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const affiliate = useAffiliate();

const loading = ref(false);
const referrals = ref<any[]>([]);
const partners = ref<any[]>([]);
const partnerId = ref<string>('');
const status = ref<string>('');

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

async function loadPartners() {
  try {
    const res: any = await affiliate.getPartners(1);
    partners.value = res.data ?? res ?? [];
  } catch (err: any) {
    toast.error('Error cargando partners', { description: err.message });
  }
}

async function loadReferrals() {
  loading.value = true;
  try {
    const res: any = await affiliate.getReferrals(
      partnerId.value ? Number(partnerId.value) : undefined,
      status.value || undefined,
    );
    referrals.value = res.data ?? res ?? [];
  } catch (err: any) {
    toast.error('Error cargando referencias', { description: err.message });
  } finally {
    loading.value = false;
  }
}

function onFilterChange() {
  loadReferrals();
}

onMounted(async () => {
  await loadPartners();
  await loadReferrals();
});
</script>

<template>
  <div class="p-6 space-y-4">
    <h1 class="text-2xl font-bold">Referencias</h1>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 items-end">
      <div class="form-control w-56">
        <label class="label"><span class="label-text">Partner</span></label>
        <select v-model="partnerId" class="select select-bordered w-full" @change="onFilterChange">
          <option value="">Todos</option>
          <option v-for="p in partners" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div class="form-control w-48">
        <label class="label"><span class="label-text">Estado</span></label>
        <select v-model="status" class="select select-bordered w-full" @change="onFilterChange">
          <option value="">Todos</option>
          <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Cliente</th>
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
                <td>{{ r.partner?.name || '—' }}</td>
                <td class="font-medium">{{ r.clientName || '—' }}</td>
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