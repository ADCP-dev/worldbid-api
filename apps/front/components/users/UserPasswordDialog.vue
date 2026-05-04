<script setup lang="ts">
import { ref } from 'vue';
import { useUsers } from '~/composables/useUsers';
import { toast } from 'vue-sonner';

const props = defineProps({
  user: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['saved', 'close']);

const { changePassword } = useUsers();

const password = ref('');
const isSubmitting = ref(false);
const dialogRef = ref<HTMLDialogElement | null>(null);

const openDialog = () => {
  password.value = '';
  dialogRef.value?.showModal();
};

const closeDialog = () => {
  dialogRef.value?.close();
  emit('close');
};

const handleSubmit = async () => {
  if (!password.value || password.value.length < 6) {
    toast.error('La contraseña debe tener al menos 6 caracteres');
    return;
  }

  isSubmitting.value = true;
  try {
    await changePassword(props.user.id, password.value);
    toast.success('Contraseña actualizada correctamente');
    emit('saved');
    closeDialog();
  } catch (error: any) {
    console.error(error);
    toast.error(error.message || 'Error al actualizar la contraseña');
  } finally {
    isSubmitting.value = false;
  }
};

defineExpose({ openDialog, closeDialog });
</script>

<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Cambiar Contraseña</h3>
      <p v-if="user" class="text-sm text-base-content/70 mb-4">Usuario: {{ user.email }}</p>

      <form @submit.prevent="handleSubmit">
        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">Nueva Contraseña</span>
          </label>
          <input
            v-model="password"
            type="password"
            class="input input-bordered w-full"
            required
            minlength="6"
          >
        </div>

        <div class="modal-action">
          <button type="button" class="btn" :disabled="isSubmitting" @click="closeDialog">Cancelar</button>
          <button type="submit" class="btn btn-warning" :disabled="isSubmitting">
            <span v-if="isSubmitting" class="loading loading-spinner loading-xs"/>
            Actualizar
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
