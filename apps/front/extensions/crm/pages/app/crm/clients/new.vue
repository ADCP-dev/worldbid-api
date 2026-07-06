<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';

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

const statusOptions = computed(() => [
  { label: 'Sin estado', value: '' },
  ...statuses.value.map((s: any) => ({ label: s.label, value: s.id })),
]);

const originOptions = computed(() => [
  { label: 'Sin origen', value: '' },
  ...origins.value.map((o: any) => ({ label: o.label, value: o.id })),
]);

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
          <FormInput v-model="form.name" label="Nombre" required placeholder="Nombre del cliente" />
          <FormInput v-model="form.companyName" label="Empresa" placeholder="Empresa" />
          <FormInput v-model="form.nif" label="NIF" placeholder="NIF" />
          <FormInput v-model="form.email" label="Email" type="email" placeholder="email@ejemplo.com" />
          <FormInput v-model="form.phone" label="Teléfono" placeholder="Teléfono" />
          <FormInput v-model="form.address" label="Dirección" placeholder="Dirección" />
          <FormInput v-model="form.city" label="Ciudad" placeholder="Ciudad" />
          <FormInput v-model="form.region" label="Región" placeholder="Región" />
          <FormInput v-model="form.country" label="País" placeholder="País" />
          <FormSelect v-model="form.statusId" label="Estado" :options="statusOptions" />
          <FormSelect v-model="form.originId" label="Origen" :options="originOptions" />
          <FormInput v-model="form.originDetail" label="Detalle de origen" placeholder="Detalle de origen" />
          <div class="md:col-span-2">
            <FormTextArea v-model="form.metadata" label="Metadata (JSON opcional)" :rows="4" />
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