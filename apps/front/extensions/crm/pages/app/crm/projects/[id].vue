<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import type {
  Client,
  Project,
  ProjectType,
  ProjectStatus,
  PaymentStatus,
} from '@crm/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const route = useRoute();
const crm = useCrm();

const projectId = computed(() => route.params.id as string);

const loading = ref(false);
const saving = ref(false);
const project = ref<Project | null>(null);
const client = ref<Client | null>(null);

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

async function loadProject() {
  loading.value = true;
  try {
    const data = await crm.getProject(projectId.value);
    project.value = data;
    const desc =
      isRecord(data.metadata) && typeof data.metadata.description === 'string'
        ? data.metadata.description
        : '';
    form.value = {
      name: data.name || '',
      description: desc,
      clientId: data.clientId ?? '',
      type: (data.type as ProjectType) || 'custom',
      price: data.price ?? '',
      status: (data.status as ProjectStatus) || 'quoted',
      paymentStatus: (data.paymentStatus as PaymentStatus) || 'pending',
      startDate: data.startDate || '',
      endDate: data.endDate || '',
    };
    if (data.clientId) {
      try {
        client.value = await crm.getClient(data.clientId);
      } catch {
        client.value = null;
      }
    }
  } catch (err: unknown) {
    toast.error('Error cargando proyecto', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!form.value.name.trim()) {
    toast.error('El nombre es obligatorio');
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
    const updated = await crm.updateProject(projectId.value, payload);
    project.value = updated;
    toast.success('Proyecto actualizado');
  } catch (err: unknown) {
    toast.error('Error guardando proyecto', { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!confirm('¿Eliminar proyecto? Esta acción no se puede deshacer.')) return;
  try {
    await crm.deleteProject(projectId.value);
    toast.success('Proyecto eliminado');
    navigateTo('/app/crm/projects');
  } catch (err: unknown) {
    toast.error('Error eliminando proyecto', { description: errorMessage(err) });
  }
}

onMounted(loadProject);
</script>

<template>
  <div class="p-6 space-y-4">
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <NuxtLink to="/app/crm/projects" class="btn btn-ghost btn-sm">
            ← Volver
          </NuxtLink>
          <div>
            <h1 class="text-2xl font-bold">{{ project?.name }}</h1>
            <div class="flex items-center gap-2 mt-1">
              <span
                v-if="project?.status"
                class="badge badge-sm badge-ghost"
              >{{ PROJECT_STATUS_LABELS[project.status] ?? project.status }}</span>
              <span
                v-if="project?.paymentStatus"
                class="badge badge-sm badge-outline"
              >{{ PAYMENT_STATUS_LABELS[project.paymentStatus] ?? project.paymentStatus }}</span>
              <NuxtLink
                v-if="client"
                :to="`/app/crm/clients/${client.id}`"
                class="link link-hover text-sm"
              >
                {{ client.name }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit form -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title">Datos del proyecto</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              v-model="form.name"
              label="Nombre"
              required
            />
            <FormInput
              v-model="form.clientId"
              label="Cliente (ID)"
              type="number"
              disabled
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
              />
            </div>
          </div>
          <div class="card-actions justify-between mt-4">
            <button class="btn btn-error btn-outline" @click="remove">
              Eliminar
            </button>
            <div class="flex gap-2">
              <NuxtLink to="/app/crm/projects" class="btn btn-ghost">Cancelar</NuxtLink>
              <button class="btn btn-primary" :disabled="saving" @click="save">
                <span v-if="saving" class="loading loading-spinner loading-xs"></span>
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>