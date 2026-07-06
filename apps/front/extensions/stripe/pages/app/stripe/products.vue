<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { toast } from 'vue-sonner';
import { Plus, Eye, Pencil, Trash2 } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import ViewButton from '@base/ui-app/components/data-table/buttons/ViewButton.vue';
import EditButton from '@base/ui-app/components/data-table/buttons/EditButton.vue';
import DeleteButton from '@base/ui-app/components/data-table/buttons/DeleteButton.vue';
import {
  useProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} from '@stripe/composables/useStripe';
import type { CellContext, Product, ProductPayload } from '@stripe/types';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const { data: productsData, isLoading, refetch } = useProductsQuery();
const createMut = useCreateProductMutation();
const updateMut = useUpdateProductMutation();
const deleteMut = useDeleteProductMutation();

const products = computed<Product[]>(() => {
  const d = productsData.value;
  if (!d) return [];
  return Array.isArray(d) ? d : (d.data ?? []);
});

const showModal = ref(false);
const editingId = ref<string | null>(null);
const saving = ref(false);
const deleteTarget = ref<Product | null>(null);

const form = ref({
  name: '',
  description: '',
  stripeProductId: '',
  active: true,
});

function resetForm() {
  form.value = { name: '', description: '', stripeProductId: '', active: true };
  editingId.value = null;
}

function openCreate() {
  resetForm();
  showModal.value = true;
}

function openEdit(product: Product) {
  editingId.value = product.id;
  form.value = {
    name: product.name || '',
    description: product.description || '',
    stripeProductId: product.stripeProductId || '',
    active: product.active,
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
  if (!form.value.name.trim()) {
    toast.error('El nombre es obligatorio');
    return;
  }
  saving.value = true;
  const payload: ProductPayload = {
    name: form.value.name,
    description: form.value.description || null,
    stripeProductId: form.value.stripeProductId || null,
    active: form.value.active,
  };
  try {
    if (editingId.value) {
      await updateMut.mutateAsync({ id: editingId.value, payload });
      toast.success('Producto actualizado');
    } else {
      await createMut.mutateAsync(payload);
      toast.success('Producto creado');
    }
    closeModal();
  } catch (err: unknown) {
    toast.error('Error guardando producto', { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteMut.mutateAsync(deleteTarget.value.id);
    toast.success('Producto eliminado');
    deleteTarget.value = null;
  } catch (err: unknown) {
    toast.error('Error eliminando producto', { description: errorMessage(err) });
  }
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
    cell: ({ row }: CellContext<Product>) =>
      row.original.description ||
      h('span', { class: 'text-base-content/40' }, '—'),
  },
  {
    accessorKey: 'stripeProductId',
    headerName: 'Stripe ID',
    header: 'Stripe ID',
    cell: ({ row }: CellContext<Product>) =>
      row.original.stripeProductId
        ? h('span', { class: 'font-mono text-xs' }, row.original.stripeProductId)
        : h('span', { class: 'text-base-content/40' }, '—'),
  },
  {
    accessorKey: 'active',
    headerName: 'Activo',
    header: 'Activo',
    filterType: 'boolean' as const,
    cell: ({ row }: CellContext<Product>) =>
      h(
        'span',
        {
          class: `badge badge-xs ${row.original.active ? 'badge-success' : 'badge-ghost'}`,
        },
        row.original.active ? 'Sí' : 'No',
      ),
  },
  {
    id: 'pricesCount',
    headerName: 'Precios',
    header: 'Precios',
    enableSorting: false,
    cell: ({ row }: CellContext<Product>) =>
      row.original.prices?.length ?? 0,
  },
  {
    id: 'actions',
    headerName: 'Acciones',
    header: 'Acciones',
    enableSorting: false,
    cell: ({ row }: CellContext<Product>) =>
      h('div', { class: 'flex items-center gap-1' }, [
        h(ViewButton, {
          ariaLabel: `Ver ${row.original.name}`,
          onClick: (e: Event) => {
            e.stopPropagation();
            navigateTo(`/app/stripe/products/${row.original.id}`);
          },
        }),
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
      <h1 class="text-2xl font-bold">Productos</h1>
      <button class="btn btn-primary btn-sm" @click="openCreate">
        <Plus class="w-4 h-4" /> Añadir producto
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
          :data="products"
          manual
          table-name="stripe-products"
          @row-click="(row: Product) => navigateTo(`/app/stripe/products/${row.id}`)"
        />
      </div>
    </div>

    <!-- Create/Edit modal -->
    <dialog v-if="showModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">
          {{ editingId ? 'Editar producto' : 'Nuevo producto' }}
        </h3>
        <div class="py-4 space-y-4">
          <FormInput
            v-model="form.name"
            label="Nombre"
            required
            placeholder="Nombre del producto"
          />
          <FormTextArea
            v-model="form.description"
            label="Descripción"
            :rows="3"
            placeholder="Descripción del producto"
          />
          <FormInput
            v-model="form.stripeProductId"
            label="Stripe Product ID"
            placeholder="prod_..."
            description="ID del producto en Stripe (opcional)"
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
        <h3 class="text-lg font-bold">Eliminar producto</h3>
        <p class="py-4">
          ¿Seguro que quieres eliminar
          <strong>{{ deleteTarget.name }}</strong>? Esta acción no se puede deshacer.
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