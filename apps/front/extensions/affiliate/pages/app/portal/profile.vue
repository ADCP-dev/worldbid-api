<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const affiliate = useAffiliate();

const loading = ref(false);
const saving = ref(false);

const form = ref({
  name: '',
  phone: '',
  iban: '',
});

async function loadProfile() {
  loading.value = true;
  try {
    const data: any = await affiliate.getMyProfile();
    form.value = {
      name: data.name || '',
      phone: data.phone || '',
      iban: data.iban || '',
    };
  } catch (err: any) {
    toast.error('Error cargando perfil', { description: err.message });
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!form.value.name.trim()) {
    toast.error('El nombre es obligatorio');
    return;
  }
  saving.value = true;
  try {
    await affiliate.updateMyProfile({ ...form.value });
    toast.success('Perfil actualizado');
  } catch (err: any) {
    toast.error('Error guardando perfil', { description: err.message });
  } finally {
    saving.value = false;
  }
}

onMounted(loadProfile);
</script>

<template>
  <div class="p-6 space-y-4">
    <h1 class="text-2xl font-bold">Mi perfil</h1>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <div v-else class="card bg-base-100 shadow-sm border border-base-300 max-w-2xl">
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control md:col-span-2">
            <label class="label"><span class="label-text">Nombre *</span></label>
            <input v-model="form.name" class="input input-bordered w-full">
          </div>
          <div class="form-control md:col-span-2">
            <label class="label"><span class="label-text">Teléfono</span></label>
            <input v-model="form.phone" class="input input-bordered w-full">
          </div>
          <div class="form-control md:col-span-2">
            <label class="label"><span class="label-text">IBAN</span></label>
            <input v-model="form.iban" class="input input-bordered w-full font-mono">
          </div>
        </div>
        <div class="card-actions justify-end mt-4">
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            Guardar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>