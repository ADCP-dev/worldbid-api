<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const crm = useCrm();

const loading = ref(false);
const clients = ref<any[]>([]);
const statuses = ref<any[]>([]);
const origins = ref<any[]>([]);

const page = ref(1);
const limit = ref(20);
const totalPages = ref(1);
const total = ref(0);

const search = ref('');
const statusId = ref<string>('');
const originId = ref<string>('');

let searchTimer: any = null;

async function loadClients() {
  loading.value = true;
  try {
    const res: any = await crm.getClients(
      page.value,
      limit.value,
      search.value || undefined,
      statusId.value ? Number(statusId.value) : undefined,
      originId.value ? Number(originId.value) : undefined,
    );
    clients.value = res.data ?? res ?? [];
    total.value = res.total ?? clients.value.length;
    totalPages.value = res.totalPages ?? Math.ceil(total.value / limit.value) || 1;
  } catch (err: any) {
    toast.error('Error cargando clientes', { description: err.message });
  } finally {
    loading.value = false;
  }
}

async function loadFilters() {
  try {
    const [stat, orig] = await Promise.all([crm.getStatuses(), crm.getOrigins()]);
    statuses.value = stat;
    origins.value = orig;
  } catch (err: any) {
    toast.error('Error cargando filtros', { description: err.message });
  }
}

function onSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    loadClients();
  }, 300);
}

function onFilterChange() {
  page.value = 1;
  loadClients();
}

function prevPage() {
  if (page.value > 1) {
    page.value--;
    loadClients();
  }
}

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++;
    loadClients();
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

async function navigateToClient(id: number | string) {
  await navigateTo(`/app/crm/clients/${id}`);
}

onMounted(() => {
  loadFilters();
  loadClients();
});
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Clientes</h1>
      <NuxtLink to="/app/crm/clients/new" class="btn btn-primary btn-sm">
        Nuevo cliente
      </NuxtLink>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 items-end">
      <div class="form-control flex-1 min-w-[200px]">
        <label class="label"><span class="label-text">Buscar</span></label>
        <input
          v-model="search"
          class="input input-bordered w-full"
          placeholder="Nombre, empresa..."
          @input="onSearch"
        >
      </div>
      <div class="form-control w-48">
        <label class="label"><span class="label-text">Estado</span></label>
        <select
          v-model="statusId"
          class="select select-bordered w-full"
          @change="onFilterChange"
        >
          <option value="">Todos</option>
          <option v-for="s in statuses" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
      </div>
      <div class="form-control w-48">
        <label class="label"><span class="label-text">Origen</span></label>
        <select
          v-model="originId"
          class="select select-bordered w-full"
          @change="onFilterChange"
        >
          <option value="">Todos</option>
          <option v-for="o in origins" :key="o.id" :value="o.id">{{ o.label }}</option>
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
                <th>Nombre</th>
                <th>Empresa</th>
                <th>Estado</th>
                <th>Origen</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="5" class="text-center py-8">
                  <span class="loading loading-spinner loading-md text-primary" />
                </td>
              </tr>
              <tr v-else-if="clients.length === 0">
                <td colspan="5" class="text-center text-base-content/40 py-8">
                  Sin clientes
                </td>
              </tr>
              <tr
                v-else
                v-for="client in clients"
                :key="client.id"
                class="hover cursor-pointer"
                @click="navigateToClient(client.id)"
              >
                <td class="font-medium">{{ client.name }}</td>
                <td>{{ client.companyName || '—' }}</td>
                <td>
                  <span
                    v-if="client.status"
                    class="badge badge-sm"
                    :style="{ backgroundColor: client.status.color, color: '#fff' }"
                  >
                    {{ client.status.label }}
                  </span>
                  <span v-else class="text-base-content/40">—</span>
                </td>
                <td>{{ client.origin?.label || '—' }}</td>
                <td>{{ formatDate(client.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-between p-4 border-t border-base-300">
          <span class="text-sm text-base-content/60">
            {{ total }} clientes · Página {{ page }} de {{ totalPages }}
          </span>
          <div class="join">
            <button
              class="btn btn-sm join-item"
              :disabled="page === 1"
              @click="prevPage"
            >«</button>
            <button class="btn btn-sm join-item">{{ page }}</button>
            <button
              class="btn btn-sm join-item"
              :disabled="page >= totalPages"
              @click="nextPage"
            >»</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>