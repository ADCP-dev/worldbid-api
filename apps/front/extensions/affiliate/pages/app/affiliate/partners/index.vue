<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const affiliate = useAffiliate();

const loading = ref(false);
const partners = ref<any[]>([]);
const search = ref('');
let searchTimer: any = null;

async function loadPartners() {
  loading.value = true;
  try {
    const res: any = await affiliate.getPartners(1, search.value || undefined);
    partners.value = res.data ?? res ?? [];
  } catch (err: any) {
    toast.error('Error cargando partners', { description: err.message });
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadPartners, 300);
}

function navigateToPartner(id: number | string) {
  navigateTo(`/app/affiliate/partners/${id}`);
}

function formatRate(rate: number) {
  return `${(rate ?? 0).toFixed(2)}%`;
}

onMounted(loadPartners);
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Partners</h1>
      <NuxtLink to="/app/affiliate/partners/new" class="btn btn-primary btn-sm">
        Nuevo partner
      </NuxtLink>
    </div>

    <!-- Search -->
    <div class="form-control w-full max-w-md">
      <label class="label"><span class="label-text">Buscar</span></label>
      <input
        v-model="search"
        class="input input-bordered w-full"
        placeholder="Nombre, empresa, email..."
        @input="onSearch"
      >
    </div>

    <!-- Table -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Empresa</th>
                <th>Email</th>
                <th>Comisión</th>
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="text-center py-8">
                  <span class="loading loading-spinner loading-md text-primary" />
                </td>
              </tr>
              <tr v-else-if="partners.length === 0">
                <td colspan="6" class="text-center text-base-content/40 py-8">
                  Sin partners
                </td>
              </tr>
              <tr
                v-else
                v-for="partner in partners"
                :key="partner.id"
                class="hover cursor-pointer"
                @click="navigateToPartner(partner.id)"
              >
                <td class="font-medium">{{ partner.name }}</td>
                <td>{{ partner.companyName || '—' }}</td>
                <td>{{ partner.email || '—' }}</td>
                <td>{{ formatRate(partner.commissionRate) }}</td>
                <td>
                  <span v-if="partner.isActive" class="badge badge-sm badge-success">Sí</span>
                  <span v-else class="badge badge-sm badge-ghost">No</span>
                </td>
                <td @click.stop>
                  <NuxtLink :to="`/app/affiliate/partners/${partner.id}`" class="btn btn-ghost btn-xs">
                    Ver
                  </NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>