<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import type { PortalProfile } from '@affiliate/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});

const affiliate = useAffiliate();

const loading = ref(false);
const saving = ref(false);

const name = ref('');
const phone = ref('');
const iban = ref('');


async function loadProfile() {
  loading.value = true;
  try {
    const data: PortalProfile = await affiliate.getMyProfile();
    name.value = data.name || '';
    phone.value = data.phone || '';
    iban.value = data.iban || '';
  } catch (err: unknown) {
    toast.error('Error cargando perfil', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!name.value.trim()) {
    toast.error('El nombre es obligatorio');
    return;
  }
  saving.value = true;
  try {
    await affiliate.updateMyProfile({
      name: name.value,
      phone: phone.value,
      iban: iban.value,
    });
    toast.success('Perfil actualizado');
  } catch (err: unknown) {
    toast.error('Error guardando perfil', { description: errorMessage(err) });
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
          <div class="md:col-span-2">
            <FormInput
              v-model="name"
              label="Nombre"
              placeholder="Nombre"
              required
            />
          </div>
          <div class="md:col-span-2">
            <FormInput
              v-model="phone"
              label="Teléfono"
              placeholder="Teléfono"
            />
          </div>
          <div class="md:col-span-2">
            <FormInput
              v-model="iban"
              label="IBAN"
              placeholder="ES00 0000 0000 0000 0000 0000"
            />
          </div>
        </div>
        <div class="card-actions justify-end mt-4">
          <button class="btn btn-primary" :disabled="saving" @click="submit">
            <span v-if="saving" class="loading loading-spinner loading-xs"/>
            Guardar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>