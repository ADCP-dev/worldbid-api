<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue';
import { toast } from 'vue-sonner';
import type { Row } from '@tanstack/vue-table';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import type { Origin, OriginPayload } from '@/extensions/crm/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const crm = useCrm();

const loading = ref(false);
const saving = ref(false);
const origins = ref<Origin[]>([]);

const isModalOpen = ref(false);
const editingId = ref<number | null>(null);

const form = ref({
  label: '',
  name: '',
  type: 'referral',
  isActive: true,
  sortOrder: 0 as string | number,
});

const ORIGIN_TYPE_LABELS: Record<string, string> = {
  referral: 'Referido',
  organic: 'Orgánico',
  ads: 'Anuncios',
  event: 'Evento',
  social: 'Social',
  website: 'Web',
  other: 'Otro',
};

const originTypeOptions = computed(() =>
  Object.entries(ORIGIN_TYPE_LABELS).map(([value, label]) => ({ value, label })),
);

const columns = [
  { accessorKey: 'label', headerName: 'Label', header: 'Label', filterType: 'string' as const },
  { accessorKey: 'name', headerName: 'Name', header: 'Name', filterType: 'string' as const },
  {
    accessorKey: 'type',
    headerName: 'Tipo',
    header: 'Tipo',
    filterType: 'select' as const,
    options: originTypeOptions.value,
    cell: ({ row }: { row: Row<Origin> }) => h('span', { class: 'badge badge-sm badge-ghost' },
      ORIGIN_TYPE_LABELS[row.original.type] ?? row.original.type),
  },
  { accessorKey: 'sortOrder', headerName: 'Orden', header: 'Orden', filterType: 'number' as const },
  {
    accessorKey: 'isActive',
    headerName: 'Activo',
    header: 'Activo',
    filterType: 'boolean' as const,
    cell: ({ row }: { row: Row<Origin> }) => row.original.isActive
      ? h('span', { class: 'badge badge-xs badge-success' }, 'Sí')
      : h('span', { class: 'badge badge-xs badge-ghost' }, 'No'),
  },
  {
    id: 'actions',
    headerName: 'Acciones',
    header: 'Acciones',
    enableSorting: false,
    cell: ({ row }: { row: Row<Origin> }) => h('div', { class: 'flex items-center gap-1' }, [
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

async function load() {
  loading.value = true;
  try {
    origins.value = await crm.getOrigins();
  } catch (err: unknown) {
    toast.error('Error cargando orígenes', { description: err instanceof Error ? err.message : 'Error' });
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  form.value = {
    label: '',
    name: '',
    type: 'referral',
    isActive: true,
    sortOrder: 0,
  };
  isModalOpen.value = true;
}

function openEdit(origin: Origin) {
  editingId.value = origin.id;
  form.value = {
    label: origin.label || '',
    name: origin.name || '',
    type: origin.type || 'referral',
    isActive: origin.isActive ?? true,
    sortOrder: origin.sortOrder ?? 0,
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
    const payload: OriginPayload = { ...form.value };
    if (editingId.value) {
      await crm.updateOrigin(editingId.value, payload);
      toast.success('Origen actualizado');
    } else {
      await crm.createOrigin(payload);
      toast.success('Origen creado');
    }
    isModalOpen.value = false;
    await load();
  } catch (err: unknown) {
    toast.error('Error guardando origen', { description: err instanceof Error ? err.message : 'Error' });
  } finally {
    saving.value = false;
  }
}

async function remove(id: number) {
  if (!confirm('¿Eliminar origen?')) return;
  try {
    await crm.deleteOrigin(id);
    toast.success('Origen eliminado');
    await load();
  } catch (err: unknown) {
    toast.error('Error eliminando origen', { description: err instanceof Error ? err.message : 'Error' });
  }
}

onMounted(load);
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink to="/app/crm" class="btn btn-ghost btn-sm">← Dashboard</NuxtLink>
        <h1 class="text-2xl font-bold">Orígenes</h1>
      </div>
      <button class="btn btn-primary btn-sm" @click="openCreate">Nuevo origen</button>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="origins"
          table-name="crm-origins"
        />
      </div>
    </div>

    <!-- Modal -->
    <dialog class="modal" :class="{ 'modal-open': isModalOpen }">
      <div class="modal-box max-w-md">
        <h3 class="font-bold text-lg mb-4">
          {{ editingId ? 'Editar origen' : 'Nuevo origen' }}
        </h3>
        <div class="space-y-3">
          <FormInput v-model="form.label" label="Label" required placeholder="Referido" />
          <FormInput v-model="form.name" label="Name (slug)" required placeholder="referral" />
          <FormSelect v-model="form.type" label="Tipo" :options="originTypeOptions" />
          <FormInput v-model="form.sortOrder" label="Orden" type="number" />
          <FormSwitch v-model="form.isActive" label="Activo" />
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