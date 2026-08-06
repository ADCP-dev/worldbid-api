<script setup lang="ts">
import { ref } from 'vue';
import { toast } from 'vue-sonner';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import type { CreatePartnerPayload, Partner } from '@affiliate/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const affiliate = useAffiliate();

const saving = ref(false);

const name = ref('');
const companyName = ref('');
const email = ref('');
const phone = ref('');
const iban = ref('');
const commissionRate = ref<string | number>('');


async function submit() {
  if (!name.value.trim()) {
    toast.error('El nombre es obligatorio');
    return;
  }
  saving.value = true;
  try {
    const payload: CreatePartnerPayload = {
      name: name.value,
      companyName: companyName.value,
      email: email.value,
      phone: phone.value,
      iban: iban.value,
      commissionRate: commissionRate.value === '' ? null : Number(commissionRate.value),
    };
    const partner: Partner = await affiliate.createPartner(payload);
    toast.success('Partner creado');
    navigateTo(`/app/affiliate/partners/${partner.id}`);
  } catch (err: unknown) {
    toast.error('Error creando partner', { description: errorMessage(err) });
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
          <FormInput
            v-model="name"
            label="Nombre"
            placeholder="Nombre del partner"
            required
          />
          <FormInput
            v-model="companyName"
            label="Empresa"
            placeholder="Empresa"
          />
          <FormInput
            v-model="email"
            label="Email"
            placeholder="email@ejemplo.com"
            type="email"
          />
          <FormInput
            v-model="phone"
            label="Teléfono"
            placeholder="Teléfono"
          />
          <FormInput
            v-model="iban"
            label="IBAN"
            placeholder="ES00 0000 0000 0000 0000 0000"
          />
          <FormInput
            v-model="commissionRate"
            label="Comisión (%)"
            placeholder="0.00"
            type="number"
            step="0.01"
          />
        </div>
        <div class="card-actions justify-end mt-4">
          <NuxtLink to="/app/affiliate/partners" class="btn btn-ghost">Cancelar</NuxtLink>
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="loading loading-spinner loading-xs"/>
            Crear partner
          </button>
        </div>
      </div>
    </div>
  </div>
</template>