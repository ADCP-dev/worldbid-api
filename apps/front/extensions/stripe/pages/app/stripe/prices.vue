<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { toast } from 'vue-sonner';
import { Plus } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import EditButton from '@base/ui-app/components/data-table/buttons/EditButton.vue';
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue';
import {
  usePricesQuery,
  useProductsQuery,
  useCreatePriceMutation,
  useUpdatePriceMutation,
  useDeletePriceMutation,
} from '@stripe/composables/useStripe';
import type { CellContext, Price, PricePayload, PriceInterval, Product } from '@stripe/types';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const { data: pricesData, isLoading } = usePricesQuery();
const { data: productsData } = useProductsQuery();
const createMut = useCreatePriceMutation();
const updateMut = useUpdatePriceMutation();
const deleteMut = useDeletePriceMutation();

const prices = computed<Price[]>(() => {
  const d = pricesData.value;
  if (!d) return [];
  return Array.isArray(d) ? d : (d.data ?? []);
});

const products = computed<Product[]>(() => {
  const d = productsData.value;
  if (!d) return [];
  return Array.isArray(d) ? d : (d.data ?? []);
});

const productOptions = computed(() =>
  products.value.map((p) => ({ label: p.name, value: p.id })),
);

const intervalOptions = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
];

const showModal = ref(false);
const editingId = ref<string | null>(null);
const saving = ref(false);
const deleteTarget = ref<Price | null>(null);

const form = ref({
  productId: '' as string | number,
  unitAmount: 0,
  currency: 'eur',
  interval: 'month' as PriceInterval,
  intervalCount: 1,
  active: true,
});

function resetForm() {
  form.value = {
    productId: '',
    unitAmount: 0,
    currency: 'eur',
    interval: 'month',
    intervalCount: 1,
    active: true,
  };
  editingId.value = null;
}

function openCreate() {
  resetForm();
  showModal.value = true;
}

function openEdit(price: Price) {
  editingId.value = price.id;
  form.value = {
    productId: price.productId,
    unitAmount: price.unitAmount,
    currency: price.currency,
    interval: (price.interval || 'month') as PriceInterval,
    intervalCount: price.intervalCount ?? 1,
    active: price.active,
  };
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  resetForm();
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function submit() {
  if (!form.value.productId) {
    toast.error('Selecciona un producto');
    return;
  }
  if (form.value.unitAmount <= 0) {
    toast.error('El importe debe ser mayor que 0');
    return;
  }
  saving.value = true;
  const payload: PricePayload = {
    productId: String(form.value.productId),
    unitAmount: Number(form.value.unitAmount),
    currency: form.value.currency,
    interval: form.value.interval,
    intervalCount: Number(form.value.intervalCount),
    active: form.value.active,
  };
  try {
    if (editingId.value) {
      await updateMut.mutateAsync({ id: editingId.value, payload });
      toast.success('Precio actualizado');
    } else {
      await createMut.mutateAsync(payload);
      toast.success('Precio creado');
    }
    closeModal();
  } catch (err: unknown) {
    toast.error('Error guardando precio', { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteMut.mutateAsync(deleteTarget.value.id);
    toast.success('Precio eliminado');
    deleteTarget.value = null;
  } catch (err: unknown) {
    toast.error('Error eliminando precio', { description: errorMessage(err) });
  }
}

function formatAmount(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

const columns = computed(() => [
  {
    accessorKey: 'unitAmount',
    headerName: 'Importe',
    header: 'Importe',
    filterType: 'number' as const,
    cell: ({ row }: CellContext<Price>) =>
      formatAmount(row.original.unitAmount, row.original.currency),
  },
  {
    accessorKey: 'currency',
    headerName: 'Moneda',
    header: 'Moneda',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Price>) => row.original.currency.toUpperCase(),
  },
  {
    accessorKey: 'interval',
    headerName: 'Intervalo',
    header: 'Intervalo',
    filterType: 'select' as const,
    options: intervalOptions,
    cell: ({ row }: CellContext<Price>) =>
      `${row.original.intervalCount ? `${row.original.intervalCount} ` : ''}${row.original.interval || '—'}`,
  },
  {
    id: 'productName',
    headerName: 'Producto',
    header: 'Producto',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Price>) =>
      row.original.product?.name || h('span', { class: 'text-base-content/40' }, '—'),
  },
  {
    accessorKey: 'active',
    headerName: 'Activo',
    header: 'Activo',
    filterType: 'boolean' as const,
    cell: ({ row }: CellContext<Price>) =>
      h(
        'span',
        {
          class: `badge badge-xs ${row.original.active ? 'badge-success' : 'badge-ghost'}`,
        },
        row.original.active ? 'Sí' : 'No',
      ),
  },
  {
    id: 'actions',
    headerName: 'Acciones',
    header: 'Acciones',
    enableSorting: false,
    cell: ({ row }: CellContext<Price>) =>
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
      <h1 class="text-2xl font-bold">Precios</h1>
      <button class="btn btn-primary btn-sm" @click="openCreate">
        <Plus class="w-4 h-4" /> Añadir precio
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
          :data="prices"
          manual
          table-name="stripe-prices"
        />
      </div>
    </div>

    <!-- Create/Edit modal -->
    <dialog v-if="showModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">
          {{ editingId ? 'Editar precio' : 'Nuevo precio' }}
        </h3>
        <div class="py-4 space-y-4">
          <FormSelect
            v-model="form.productId"
            label="Producto"
            required
            :options="productOptions"
            placeholder="Selecciona un producto"
          />
          <FormInput
            v-model="form.unitAmount"
            label="Importe (céntimos)"
            type="number"
            required
            placeholder="1000 = 10.00"
            min="1"
          />
          <FormInput
            v-model="form.currency"
            label="Moneda"
            required
            placeholder="eur"
          />
          <FormSelect
            v-model="form.interval"
            label="Intervalo"
            :options="intervalOptions"
          />
          <FormInput
            v-model="form.intervalCount"
            label="Conteo de intervalo"
            type="number"
            min="1"
          />
          <FormSwitch v-model="form.active" label="Activo" />
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
        <h3 class="text-lg font-bold">Eliminar precio</h3>
        <p class="py-4">
          ¿Seguro que quieres eliminar el precio de
          <strong>{{ formatAmount(deleteTarget.unitAmount, deleteTarget.currency) }}</strong>?
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