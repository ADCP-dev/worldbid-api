<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { toast } from 'vue-sonner';
import { Plus } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import EditButton from '@base/ui-app/components/data-table/buttons/EditButton.vue';
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue';
import {
  usePlansQuery,
  usePricesQuery,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useDeletePlanMutation,
} from '@stripe/composables/useStripe';
import type { CellContext, Plan, PlanPayload, Price } from '@stripe/types';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const { data: plansData, isLoading } = usePlansQuery();
const { data: pricesData } = usePricesQuery();
const createMut = useCreatePlanMutation();
const updateMut = useUpdatePlanMutation();
const deleteMut = useDeletePlanMutation();

const plans = computed<Plan[]>(() => {
  const d = plansData.value;
  if (!d) return [];
  return Array.isArray(d) ? d : (d.data ?? []);
});

const prices = computed<Price[]>(() => {
  const d = pricesData.value;
  if (!d) return [];
  return Array.isArray(d) ? d : (d.data ?? []);
});

const priceOptions = computed(() =>
  prices.value.map((p) => ({
    label: `${(p.unitAmount / 100).toFixed(2)} ${p.currency.toUpperCase()} / ${p.interval || '—'}`,
    value: p.id,
  })),
);

const showModal = ref(false);
const editingId = ref<string | null>(null);
const saving = ref(false);
const deleteTarget = ref<Plan | null>(null);

const form = ref({
  name: '',
  description: '',
  priceId: '' as string | number,
  active: true,
  isDefault: false,
});

function resetForm() {
  form.value = { name: '', description: '', priceId: '', active: true, isDefault: false };
  editingId.value = null;
}

function openCreate() {
  resetForm();
  showModal.value = true;
}

function openEdit(plan: Plan) {
  editingId.value = plan.id;
  form.value = {
    name: plan.name || '',
    description: plan.description || '',
    priceId: plan.priceId || '',
    active: plan.active,
    isDefault: plan.isDefault ?? false,
  };
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  resetForm();
}


async function submit() {
  if (!form.value.name.trim()) {
    toast.error('El nombre es obligatorio');
    return;
  }
  saving.value = true;
  const payload: PlanPayload = {
    name: form.value.name,
    description: form.value.description || null,
    priceId: form.value.priceId ? String(form.value.priceId) : null,
    active: form.value.active,
    isDefault: form.value.isDefault,
  };
  try {
    if (editingId.value) {
      await updateMut.mutateAsync({ id: editingId.value, payload });
      toast.success('Plan actualizado');
    } else {
      await createMut.mutateAsync(payload);
      toast.success('Plan creado');
    }
    closeModal();
  } catch (err: unknown) {
    toast.error('Error guardando plan', { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteMut.mutateAsync(deleteTarget.value.id);
    toast.success('Plan eliminado');
    deleteTarget.value = null;
  } catch (err: unknown) {
    toast.error('Error eliminando plan', { description: errorMessage(err) });
  }
}

function priceLabel(plan: Plan): string {
  const price = plan.price;
  if (!price) return '—';
  return `${(price.unitAmount / 100).toFixed(2)} ${price.currency.toUpperCase()} / ${price.interval || ''}`;
}

const columns = computed(() => [
  {
    accessorKey: 'name',
    headerName: 'Nombre',
    header: 'Nombre',
    filterType: 'string' as const,
  },
  {
    accessorKey: 'description',
    headerName: 'Descripción',
    header: 'Descripción',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Plan>) =>
      row.original.description ||
      h('span', { class: 'text-base-content/40' }, '—'),
  },
  {
    id: 'price',
    headerName: 'Precio',
    header: 'Precio',
    enableSorting: false,
    cell: ({ row }: CellContext<Plan>) => priceLabel(row.original),
  },
  {
    id: 'interval',
    headerName: 'Intervalo',
    header: 'Intervalo',
    enableSorting: false,
    cell: ({ row }: CellContext<Plan>) =>
      row.original.price?.interval || h('span', { class: 'text-base-content/40' }, '—'),
  },
  {
    accessorKey: 'active',
    headerName: 'Activo',
    header: 'Activo',
    filterType: 'boolean' as const,
    cell: ({ row }: CellContext<Plan>) =>
      h(
        'span',
        {
          class: `badge badge-xs ${row.original.active ? 'badge-success' : 'badge-ghost'}`,
        },
        row.original.active ? 'Sí' : 'No',
      ),
  },
  {
    id: 'subscribersCount',
    headerName: 'Suscriptores',
    header: 'Suscriptores',
    enableSorting: false,
    cell: ({ row }: CellContext<Plan>) => row.original.subscribersCount ?? 0,
  },
  {
    id: 'actions',
    headerName: 'Acciones',
    header: 'Acciones',
    enableSorting: false,
    cell: ({ row }: CellContext<Plan>) =>
      h('div', { class: 'flex items-center gap-1' }, [
        h(EditButton, {
          onClick: (e: Event) => {
            e.stopPropagation();
            openEdit(row.original);
          },
        }),
        h(DeleteButton, {
          onClick: (e: Event) => {
            e.stopPropagation();
            deleteTarget.value = row.original;
          },
        }),
      ]),
  },
]);
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Planes</h1>
      <button class="btn btn-primary btn-sm" @click="openCreate">
        <Plus class="w-4 h-4" /> Añadir plan
      </button>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <div v-if="isLoading" class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary" />
        </div>
        <DataTable
          v-else
          :columns="columns"
          :data="plans"
          manual
          table-name="stripe-plans"
        />
      </div>
    </div>

    <!-- Create/Edit modal -->
    <dialog v-if="showModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">
          {{ editingId ? 'Editar plan' : 'Nuevo plan' }}
        </h3>
        <div class="py-4 space-y-4">
          <FormInput v-model="form.name" label="Nombre" required />
          <FormTextArea v-model="form.description" label="Descripción" :rows="3" />
          <FormSelect
            v-model="form.priceId"
            label="Precio"
            :options="priceOptions"
            placeholder="Selecciona un precio"
          />
          <FormSwitch v-model="form.active" label="Activo" />
          <FormSwitch v-model="form.isDefault" label="Plan por defecto" />
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeModal">Cancelar</button>
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="loading loading-spinner loading-xs" />
            {{ editingId ? 'Guardar' : 'Crear' }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeModal" />
    </dialog>

    <!-- Delete confirm dialog -->
    <dialog v-if="deleteTarget" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">Eliminar plan</h3>
        <p class="py-4">
          ¿Seguro que quieres eliminar el plan
          <strong>{{ deleteTarget.name }}</strong>?
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancelar</button>
          <button class="btn btn-error" @click="confirmDelete">Eliminar</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="deleteTarget = null" />
    </dialog>
  </div>
</template>