<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { toast } from 'vue-sonner';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import type { CellContext, Status, StatusPayload } from '@/extensions/crm/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const crm = useCrm();

const loading = ref(false);
const saving = ref(false);
const statuses = ref<Status[]>([]);

const isModalOpen = ref(false);
const editingId = ref<number | null>(null);

const form = ref({
  label: '',
  name: '',
  color: '#3b82f6',
  sortOrder: 0 as string | number,
  isActive: true,
  isDefault: false,
});

const columns = [
  { accessorKey: 'label', headerName: 'Label', header: 'Label', filterType: 'string' as const },
  { accessorKey: 'name', headerName: 'Name', header: 'Name', filterType: 'string' as const },
  {
    accessorKey: 'color',
    headerName: 'Color',
    header: 'Color',
    enableSorting: false,
    cell: ({ row }: CellContext<Status>) => h('span', {
      class: 'badge badge-sm',
      style: { backgroundColor: row.original.color, color: '#fff' },
    }, row.original.color),
  },
  { accessorKey: 'sortOrder', headerName: 'Orden', header: 'Orden', filterType: 'number' as const },
  {
    accessorKey: 'isActive',
    headerName: 'Activo',
    header: 'Activo',
    filterType: 'boolean' as const,
    cell: ({ row }: CellContext<Status>) => row.original.isActive
      ? h('span', { class: 'badge badge-xs badge-success' }, 'Sí')
      : h('span', { class: 'badge badge-xs badge-ghost' }, 'No'),
  },
  {
    accessorKey: 'isDefault',
    headerName: 'Default',
    header: 'Default',
    filterType: 'boolean' as const,
    cell: ({ row }: CellContext<Status>) => row.original.isDefault
      ? h('span', { class: 'badge badge-xs badge-primary' }, 'Default')
      : h('span', { class: 'text-base-content/40' }, '—'),
  },
  {
    id: 'actions',
    headerName: 'Acciones',
    header: 'Acciones',
    enableSorting: false,
    cell: ({ row }: CellContext<Status>) => h('div', { class: 'flex items-center gap-1' }, [
      h('button', {
        class: 'btn btn-ghost btn-xs',
        onClick: (e: Event) => { e.stopPropagation(); openEdit(row.original); },
      }, 'Editar'),
      h('button', {
        class: 'btn btn-ghost btn-xs text-error',
        onClick: (e: Event) => { e.stopPropagation(); remove(row.original.id); },
      }, 'Eliminar'),
    ]),
  },
];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function load() {
  loading.value = true;
  try {
    statuses.value = await crm.getStatuses();
  } catch (err: unknown) {
    toast.error('Error cargando estados', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  form.value = {
    label: '',
    name: '',
    color: '#3b82f6',
    sortOrder: 0,
    isActive: true,
    isDefault: false,
  };
  isModalOpen.value = true;
}

function openEdit(status: Status) {
  editingId.value = status.id;
  form.value = {
    label: status.label || '',
    name: status.name || '',
    color: status.color || '#3b82f6',
    sortOrder: status.sortOrder ?? 0,
    isActive: status.isActive ?? true,
    isDefault: status.isDefault ?? false,
  };
  isModalOpen.value = true;
}

async function save() {
  if (!form.value.label.trim()) {
    toast.error('El label es obligatorio');
    return;
  }
  if (!form.value.name.trim()) {
    toast.error('El name es obligatorio');
    return;
  }
  saving.value = true;
  try {
    const payload: StatusPayload = { ...form.value };
    if (editingId.value) {
      await crm.updateStatus(editingId.value, payload);
      toast.success('Estado actualizado');
    } else {
      await crm.createStatus(payload);
      toast.success('Estado creado');
    }
    isModalOpen.value = false;
    await load();
  } catch (err: unknown) {
    toast.error('Error guardando estado', { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

async function remove(id: number) {
  if (!confirm('¿Eliminar estado?')) return;
  try {
    await crm.deleteStatus(id);
    toast.success('Estado eliminado');
    await load();
  } catch (err: unknown) {
    toast.error('Error eliminando estado', { description: errorMessage(err) });
  }
}

onMounted(load);
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink to="/app/crm" class="btn btn-ghost btn-sm">← Dashboard</NuxtLink>
        <h1 class="text-2xl font-bold">Estados</h1>
      </div>
      <button class="btn btn-primary btn-sm" @click="openCreate">Nuevo estado</button>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="statuses"
          table-name="crm-statuses"
        />
      </div>
    </div>

    <!-- Modal -->
    <dialog class="modal" :class="{ 'modal-open': isModalOpen }">
      <div class="modal-box max-w-md">
        <h3 class="font-bold text-lg mb-4">
          {{ editingId ? 'Editar estado' : 'Nuevo estado' }}
        </h3>
        <div class="space-y-3">
          <FormInput v-model="form.label" label="Label" required placeholder="En discovery" />
          <FormInput v-model="form.name" label="Name (slug)" required placeholder="discovery" />
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-semibold">Color</span>
            </label>
            <input v-model="form.color" type="color" class="input input-bordered w-full h-12">
          </div>
          <FormInput v-model="form.sortOrder" label="Orden" type="number" />
          <FormSwitch v-model="form.isActive" label="Activo" />
          <FormSwitch v-model="form.isDefault" label="Estado por defecto" />
        </div>
        <div class="modal-action">
          <button class="btn" @click="isModalOpen = false">Cancelar</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">
            <span v-if="saving" class="loading loading-spinner loading-xs"/>
            Guardar
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="isModalOpen = false">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>