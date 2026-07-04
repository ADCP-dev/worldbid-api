<script setup lang="ts">
import { ref } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const affiliate = useAffiliate();

const saving = ref(false);

const form = ref({
  name: '',
  companyName: '',
  email: '',
  phone: '',
  iban: '',
  commissionRate: '' as string | number,
});

async function submit() {
  if (!form.value.name.trim()) {
    toast.error('El nombre es obligatorio');
    return;
  }
  saving.value = true;
  try {
    const payload: Record<string, any> = { ...form.value };
    if (payload.commissionRate === '') payload.commissionRate = null;
    else payload.commissionRate = Number(payload.commissionRate);
    const partner: any = await affiliate.createPartner(payload);
    toast.success('Partner creado');
    navigateTo(`/app/affiliate/partners/${partner.id}`);
  } catch (err: any) {
    toast.error('Error creando partner', { description: err.message });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center gap-3">
      <NuxtLink to="/app/affiliate/partners" class="btn btn-ghost btn-sm">← Volver</NuxtLink>
      <h1 class="text-2xl font-bold">Nuevo partner</h1>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Nombre *</span></label>
            <input v-model="form.name" class="input input-bordered w-full">
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
          <div class="form-control">
            <label class="label"><span class="label-text">IBAN</span></label>
            <input v-model="form.iban" class="input input-bordered w-full">
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Comisión (%)</span></label>
            <input v-model="form.commissionRate" type="number" step="0.01" class="input input-bordered w-full">
          </div>
        </div>
        <div class="card-actions justify-end mt-4">
          <NuxtLink to="/app/affiliate/partners" class="btn btn-ghost">Cancelar</NuxtLink>
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            Crear partner
          </button>
        </div>
      </div>
    </div>
  </div>
</template>