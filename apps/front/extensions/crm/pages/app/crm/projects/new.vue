<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import type { Client, ProjectType, ProjectStatus, PaymentStatus } from '@crm/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const crm = useCrm();

const saving = ref(false);
const clients = ref<Client[]>([]);

const form = ref({
  name: '',
  description: '',
  clientId: '' as string | number,
  type: 'custom' as ProjectType,
  price: '' as string | number,
  status: 'quoted' as ProjectStatus,
  paymentStatus: 'pending' as PaymentStatus,
  startDate: '',
  endDate: '',
});

const PROJECT_TYPE_LABELS: Record<string, string> = {
  pack_1: 'Pack 1',
  pack_2: 'Pack 2',
  pack_3: 'Pack 3',
  pack_4: 'Pack 4',
  custom: 'Personalizado',
  consulting: 'Consultoría',
  design: 'Diseño',
  development: 'Desarrollo',
  marketing: 'Marketing',
  other: 'Otro',
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  quoted: 'Presupuestado',
  approved: 'Aprobado',
  in_progress: 'En progreso',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Completado',
  pending: 'Pendiente',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagado',
  refunded: 'Reembolsado',
  overdue: 'Vencido',
};

const clientOptions = computed(() => [
  { label: 'Sin cliente', value: '' },
  ...clients.value.map((c) => ({ label: c.name, value: c.id })),
]);

const typeOptions = computed(() =>
  Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
);

const statusOptions = computed(() =>
  Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
);

const paymentStatusOptions = computed(() =>
  Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function loadClients() {
  try {
    const res = await crm.getClients(1, 1000);
    clients.value = Array.isArray(res) ? res : (res.data ?? []);
  } catch (err: unknown) {
    toast.error('Error cargando clientes', { description: errorMessage(err) });
  }
}

async function submit() {
  if (!form.value.name.trim()) {
    toast.error('El nombre es obligatorio');
    return;
  }
  if (!form.value.clientId) {
    toast.error('El cliente es obligatorio');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: form.value.name,
      clientId: Number(form.value.clientId),
      type: form.value.type,
      status: form.value.status,
      paymentStatus: form.value.paymentStatus,
      price: form.value.price === '' ? null : Number(form.value.price),
      startDate: form.value.startDate || undefined,
      endDate: form.value.endDate || undefined,
      metadata: form.value.description
        ? { description: form.value.description }
        : undefined,
    };
    const project = await crm.createProject(payload);
    toast.success('Proyecto creado');
    navigateTo(`/app/crm/projects/${project.id}`);
  } catch (err: unknown) {
    toast.error('Error creando proyecto', { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

onMounted(loadClients);
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center gap-3">
      <NuxtLink to="/app/crm/projects" class="btn btn-ghost btn-sm">← Volver</NuxtLink>
      <h1 class="text-2xl font-bold">Nuevo proyecto</h1>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            v-model="form.name"
            label="Nombre"
            required
            placeholder="Nombre del proyecto"
          />
          <FormSelect
            v-model="form.clientId"
            label="Cliente"
            required
            :options="clientOptions"
          />
          <FormSelect
            v-model="form.type"
            label="Tipo"
            :options="typeOptions"
          />
          <FormInput
            v-model="form.price"
            label="Presupuesto"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          />
          <FormSelect
            v-model="form.status"
            label="Estado"
            :options="statusOptions"
          />
          <FormSelect
            v-model="form.paymentStatus"
            label="Estado de pago"
            :options="paymentStatusOptions"
          />
          <FormInput
            v-model="form.startDate"
            label="Fecha de inicio"
            type="text"
            placeholder="YYYY-MM-DD"
          />
          <FormInput
            v-model="form.endDate"
            label="Fecha de fin"
            type="text"
            placeholder="YYYY-MM-DD"
          />
          <div class="md:col-span-2">
            <FormTextArea
              v-model="form.description"
              label="Descripción"
              :rows="4"
              placeholder="Descripción del proyecto"
            />
          </div>
        </div>
        <div class="card-actions justify-end mt-4">
          <NuxtLink to="/app/crm/projects" class="btn btn-ghost">Cancelar</NuxtLink>
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="loading loading-spinner loading-xs"/>
            Crear proyecto
          </button>
        </div>
      </div>
    </div>
  </div>
</template>