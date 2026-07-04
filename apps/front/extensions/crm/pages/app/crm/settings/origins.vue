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
const origins = ref<any[]>([]);

const isModalOpen = ref(false);
const editingId = ref<number | null>(null);

const form = ref({
  label: '',
  name: '',
  type: 'referral',
  isActive: true,
  sortOrder: 0,
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

async function load() {
  loading.value = true;
  try {
    origins.value = await crm.getOrigins();
  } catch (err: any) {
    toast.error('Error cargando orígenes', { description: err.message });
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

function openEdit(origin: any) {
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
    const payload = { ...form.value };
    if (editingId.value) {
      await crm.updateOrigin(editingId.value, payload);
      toast.success('Origen actualizado');
    } else {
      await crm.createOrigin(payload);
      toast.success('Origen creado');
    }
    isModalOpen.value = false;
    await load();
  } catch (err: any) {
    toast.error('Error guardando origen', { description: err.message });
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
  } catch (err: any) {
    toast.error('Error eliminando origen', { description: err.message });
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
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Label</th>
                <th>Name</th>
                <th>Tipo</th>
                <th>Orden</th>
                <th>Activo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="text-center py-8">
                  <span class="loading loading-spinner loading-md text-primary" />
                </td>
              </tr>
              <tr v-else-if="origins.length === 0">
                <td colspan="6" class="text-center text-base-content/40 py-8">Sin orígenes</td>
              </tr>
              <tr v-for="origin in origins" :key="origin.id">
                <td class="font-medium">{{ origin.label }}</td>
                <td class="font-mono text-xs">{{ origin.name }}</td>
                <td>
                  <span class="badge badge-sm badge-ghost">{{ ORIGIN_TYPE_LABELS[origin.type] ?? origin.type }}</span>
                </td>
                <td>{{ origin.sortOrder }}</td>
                <td>
                  <span v-if="origin.isActive" class="badge badge-xs badge-success">Sí</span>
                  <span v-else class="badge badge-xs badge-ghost">No</span>
                </td>
                <td class="text-right">
                  <button class="btn btn-ghost btn-xs" @click="openEdit(origin)">Editar</button>
                  <button class="btn btn-ghost btn-xs text-error" @click="remove(origin.id)">Eliminar</button>
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
          {{ editingId ? 'Editar origen' : 'Nuevo origen' }}
        </h3>
        <div class="space-y-3">
          <div class="form-control">
            <label class="label"><span class="label-text">Label *</span></label>
            <input v-model="form.label" class="input input-bordered w-full" placeholder="Referido">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Name (slug) *</span></label>
            <input v-model="form.name" class="input input-bordered w-full font-mono" placeholder="referral">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Tipo</span></label>
            <select v-model="form.type" class="select select-bordered w-full">
              <option v-for="(label, value) in ORIGIN_TYPE_LABELS" :key="value" :value="value">{{ label }}</option>
            </select>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Orden</span></label>
            <input v-model="form.sortOrder" type="number" class="input input-bordered w-full">
          </div>
          <label class="label cursor-pointer justify-start gap-3">
            <input v-model="form.isActive" type="checkbox" class="checkbox checkbox-sm">
            <span class="label-text">Activo</span>
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