<script setup lang="ts">
import { ref } from 'vue';
import { toast } from 'vue-sonner';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';

definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const affiliate = useAffiliate();

const saving = ref(false);

const clientName = ref('');
const companyName = ref('');
const email = ref('');
const phone = ref('');
const notes = ref('');

async function submit() {
  if (!clientName.value.trim()) {
    toast.error('El nombre del cliente es obligatorio');
    return;
  }
  saving.value = true;
  try {
    await affiliate.createMyReferral({
      clientName: clientName.value,
      companyName: companyName.value,
      email: email.value,
      phone: phone.value,
      notes: notes.value,
    });
    toast.success('Referencia enviada');
    navigateTo('/app/portal/referrals');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    toast.error('Error creando referencia', { description: msg });
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
          <FormInput
            v-model="clientName"
            label="Nombre del cliente"
            placeholder="Nombre del cliente"
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
          <div class="md:col-span-2">
            <FormTextArea
              v-model="notes"
              label="Notas"
              placeholder="Información adicional sobre el cliente..."
              :rows="4"
            />
          </div>
        </div>
        <div class="card-actions justify-end mt-4">
          <NuxtLink to="/app/portal/referrals" class="btn btn-ghost">Cancelar</NuxtLink>
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="loading loading-spinner loading-xs"/>
            Enviar referencia
          </button>
        </div>
      </div>
    </div>
  </div>
</template>