<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const crm = useCrm();

const saving = ref(false);
const statuses = ref<any[]>([]);
const origins = ref<any[]>([]);

const form = ref({
  name: '',
  companyName: '',
  nif: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  region: '',
  country: '',
  statusId: '' as string | number,
  originId: '' as string | number,
  originDetail: '',
  metadata: '',
});

async function loadFilters() {
  try {
    const [stat, orig] = await Promise.all([crm.getStatuses(), crm.getOrigins()]);
    statuses.value = stat;
    origins.value = orig;
  } catch (err: any) {
    toast.error('Error cargando filtros', { description: err.message });
  }
}

async function submit() {
  if (!form.value.name.trim()) {
    toast.error('El nombre es obligatorio');
    return;
  }
  saving.value = true;
  try {
    const payload: Record<string, any> = { ...form.value };
    if (payload.statusId === '') payload.statusId = null;
    if (payload.originId === '') payload.originId = null;
    if (payload.metadata) {
      try {
        payload.metadata = JSON.parse(payload.metadata);
      } catch {
        toast.error('Metadata JSON inválido');
        saving.value = false;
        return;
      }
    } else {
      payload.metadata = null;
    }
    const client: any = await crm.createClient(payload);
    toast.success('Cliente creado');
    navigateTo(`/app/crm/clients/${client.id}`);
  } catch (err: any) {
    toast.error('Error creando cliente', { description: err.message });
  } finally {
    saving.value = false;
  }
}

onMounted(loadFilters);
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center gap-3">
      <NuxtLink to="/app/crm/clients" class="btn btn-ghost btn-sm">← Volver</NuxtLink>
      <h1 class="text-2xl font-bold">Nuevo cliente</h1>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Nombre *</span></label>
            <input v-model="form.name" class="input input-bordered w-full">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Empresa</span></label>
            <input v-model="form.companyName" class="input input-bordered w-full">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">NIF</span></label>
            <input v-model="form.nif" class="input input-bordered w-full">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Email</span></label>
            <input v-model="form.email" type="email" class="input input-bordered w-full">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Teléfono</span></label>
            <input v-model="form.phone" class="input input-bordered w-full">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Dirección</span></label>
            <input v-model="form.address" class="input input-bordered w-full">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Ciudad</span></label>
            <input v-model="form.city" class="input input-bordered w-full">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Región</span></label>
            <input v-model="form.region" class="input input-bordered w-full">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">País</span></label>
            <input v-model="form.country" class="input input-bordered w-full">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Estado</span></label>
            <select v-model="form.statusId" class="select select-bordered w-full">
              <option value="">Sin estado</option>
              <option v-for="s in statuses" :key="s.id" :value="s.id">{{ s.label }}</option>
            </select>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Origen</span></label>
            <select v-model="form.originId" class="select select-bordered w-full">
              <option value="">Sin origen</option>
              <option v-for="o in origins" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Detalle de origen</span></label>
            <input v-model="form.originDetail" class="input input-bordered w-full">
          </div>
          <div class="form-control md:col-span-2">
            <label class="label"><span class="label-text">Metadata (JSON opcional)</span></label>
            <textarea v-model="form.metadata" class="textarea textarea-bordered w-full font-mono" rows="4"></textarea>
          </div>
        </div>
        <div class="card-actions justify-end mt-4">
          <NuxtLink to="/app/crm/clients" class="btn btn-ghost">Cancelar</NuxtLink>
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            Crear cliente
          </button>
        </div>
      </div>
    </div>
  </div>
</template>