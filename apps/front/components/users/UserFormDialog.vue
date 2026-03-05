<script setup lang="ts">
import { ref, watch } from 'vue';
import { useUsers } from '~/composables/useUsers';
import { toast } from 'vue-sonner';

const props = defineProps({
  user: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['saved', 'close']);

const { createUser, updateUser } = useUsers();

const formData = ref({
  firstName: '',
  lastName: '',
  email: '',
  password: ''
});

const isSubmitting = ref(false);
const dialogRef = ref<HTMLDialogElement | null>(null);

watch(() => props.user, (newValue) => {
  if (newValue) {
    formData.value = {
      firstName: newValue.firstName || '',
      lastName: newValue.lastName || '',
      email: newValue.email || '',
      password: '' // Keep empty on edit
    };
  } else {
    formData.value = {
      firstName: '',
      lastName: '',
      email: '',
      password: ''
    };
  }
}, { immediate: true });

const openDialog = () => {
  dialogRef.value?.showModal();
};

const closeDialog = () => {
  dialogRef.value?.close();
  emit('close');
};

const handleSubmit = async () => {
  isSubmitting.value = true;
  try {
    const payload: any = {
      firstName: formData.value.firstName,
      lastName: formData.value.lastName,
      email: formData.value.email,
    };

    if (props.user) {
      await updateUser(props.user.id, payload);
      toast.success('User updated successfully');
    } else {
      payload.password = formData.value.password;
      await createUser(payload);
      toast.success('User created successfully');
    }

    emit('saved');
    closeDialog();
  } catch (error: any) {
    console.error(error);
    toast.error(error.message || 'Failed to save user');
  } finally {
    isSubmitting.value = false;
  }
};

defineExpose({ openDialog, closeDialog });
</script>

<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">{{ props.user ? 'Editar Usuario' : 'Crear Usuario' }}</h3>

      <form @submit.prevent="handleSubmit">
        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">Nombre</span>
          </label>
          <input
            v-model="formData.firstName"
            type="text"
            class="input input-bordered w-full"
            required
          />
        </div>

        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">Apellidos</span>
          </label>
          <input
            v-model="formData.lastName"
            type="text"
            class="input input-bordered w-full"
            required
          />
        </div>

        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">Email</span>
          </label>
          <input
            v-model="formData.email"
            type="email"
            class="input input-bordered w-full"
            required
          />
        </div>

        <div v-if="!props.user" class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">Contraseña</span>
          </label>
          <input
            v-model="formData.password"
            type="password"
            class="input input-bordered w-full"
            required
            minlength="6"
          />
        </div>

        <div class="modal-action">
          <button type="button" class="btn" @click="closeDialog" :disabled="isSubmitting">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
            <span v-if="isSubmitting" class="loading loading-spinner loading-xs"></span>
            Guardar
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
