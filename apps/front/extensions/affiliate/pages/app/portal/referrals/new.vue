<script setup lang="ts">
import { ref } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const affiliate = useAffiliate();

const saving = ref(false);

const form = ref({
  clientName: '',
  companyName: '',
  email: '',
  phone: '',
  notes: '',
});

async function submit() {
  if (!form.value.clientName.trim()) {
    toast.error('El nombre del cliente es obligatorio');
    return;
  }
  saving.value = true;
  try {
    await affiliate.createMyReferral({ ...form.value });
    toast.success('Referencia enviada');
    navigateTo('/app/portal/referrals');
  } catch (err: any) {
    toast.error('Error creando referencia', { description: err.message });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center gap-3">
      <NuxtLink to="/app/portal/referrals" class="btn btn-ghost btn-sm">← Volver</NuxtLink>
      <h1 class="text-2xl font-bold">Nueva referencia</h1>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Nombre del cliente *</span></label>
            <input v-model="form.clientName" class="input input-bordered w-full">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Empresa</span></label>
            <input v-model="form.companyName" class="input input-bordered w-full">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Email</span></label>
            <input v-model="form.email" type="email" class="input input-bordered w-full">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Teléfono</span></label>
            <input v-model="form.phone" class="input input-bordered w-full">
          </div>
          <div class="form-control md:col-span-2">
            <label class="label"><span class="label-text">Notas</span></label>
            <textarea v-model="form.notes" class="textarea textarea-bordered w-full" rows="4" placeholder="Información adicional sobre el cliente..."></textarea>
          </div>
        </div>
        <div class="card-actions justify-end mt-4">
          <NuxtLink to="/app/portal/referrals" class="btn btn-ghost">Cancelar</NuxtLink>
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            Enviar referencia
          </button>
        </div>
      </div>
    </div>
  </div>
</template>