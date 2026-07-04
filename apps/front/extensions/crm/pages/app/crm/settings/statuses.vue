<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const crm = useCrm();

const loading = ref(false);
const saving = ref(false);
const statuses = ref<any[]>([]);

const isModalOpen = ref(false);
const editingId = ref<number | null>(null);

const form = ref({
  label: '',
  name: '',
  color: '#3b82f6',
  sortOrder: 0,
  isActive: true,
  isDefault: false,
});

async function load() {
  loading.value = true;
  try {
    statuses.value = await crm.getStatuses();
  } catch (err: any) {
    toast.error('Error cargando estados', { description: err.message });
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

function openEdit(status: any) {
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
    const payload = { ...form.value };
    if (editingId.value) {
      await crm.updateStatus(editingId.value, payload);
      toast.success('Estado actualizado');
    } else {
      await crm.createStatus(payload);
      toast.success('Estado creado');
    }
    isModalOpen.value = false;
    await load();
  } catch (err: any) {
    toast.error('Error guardando estado', { description: err.message });
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
  } catch (err: any) {
    toast.error('Error eliminando estado', { description: err.message });
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
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Label</th>
                <th>Name</th>
                <th>Color</th>
                <th>Orden</th>
                <th>Activo</th>
                <th>Default</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="7" class="text-center py-8">
                  <span class="loading loading-spinner loading-md text-primary" />
                </td>
              </tr>
              <tr v-else-if="statuses.length === 0">
                <td colspan="7" class="text-center text-base-content/40 py-8">Sin estados</td>
              </tr>
              <tr v-for="status in statuses" :key="status.id">
                <td class="font-medium">{{ status.label }}</td>
                <td class="font-mono text-xs">{{ status.name }}</td>
                <td>
                  <span class="badge badge-sm" :style="{ backgroundColor: status.color, color: '#fff' }">
                    {{ status.color }}
                  </span>
                </td>
                <td>{{ status.sortOrder }}</td>
                <td>
                  <span v-if="status.isActive" class="badge badge-xs badge-success">Sí</span>
                  <span v-else class="badge badge-xs badge-ghost">No</span>
                </td>
                <td>
                  <span v-if="status.isDefault" class="badge badge-xs badge-primary">Default</span>
                  <span v-else class="text-base-content/40">—</span>
                </td>
                <td class="text-right">
                  <button class="btn btn-ghost btn-xs" @click="openEdit(status)">Editar</button>
                  <button class="btn btn-ghost btn-xs text-error" @click="remove(status.id)">Eliminar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <dialog class="modal" :class="{ 'modal-open': isModalOpen }">
      <div class="modal-box max-w-md">
        <h3 class="font-bold text-lg mb-4">
          {{ editingId ? 'Editar estado' : 'Nuevo estado' }}
        </h3>
        <div class="space-y-3">
          <div class="form-control">
            <label class="label"><span class="label-text">Label *</span></label>
            <input v-model="form.label" class="input input-bordered w-full" placeholder="En discovery">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Name (slug) *</span></label>
            <input v-model="form.name" class="input input-bordered w-full font-mono" placeholder="discovery">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Color</span></label>
            <input v-model="form.color" type="color" class="input input-bordered w-full h-12">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Orden</span></label>
            <input v-model="form.sortOrder" type="number" class="input input-bordered w-full">
          </div>
          <label class="label cursor-pointer justify-start gap-3">
            <input v-model="form.isActive" type="checkbox" class="checkbox checkbox-sm">
            <span class="label-text">Activo</span>
          </label>
          <label class="label cursor-pointer justify-start gap-3">
            <input v-model="form.isDefault" type="checkbox" class="checkbox checkbox-sm">
            <span class="label-text">Estado por defecto</span>
          </label>
        </div>
        <div class="modal-action">
          <button class="btn" @click="isModalOpen = false">Cancelar</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
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