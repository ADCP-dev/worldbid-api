<script setup lang="ts">
import { ref, watch } from 'vue';
import { useUsers } from '~/composables/useUsers';
import { toast } from 'vue-sonner';

const props = defineProps({
  user: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['saved', 'close']);

const { changeRole, changeStatus } = useUsers();

const roleId = ref<number | string>('');
const statusId = ref<number | string>('');
const isSubmitting = ref(false);
const dialogRef = ref<HTMLDialogElement | null>(null);

watch(() => props.user, (newValue) => {
  if (newValue) {
    roleId.value = newValue.role?.id ?? '';
    statusId.value = newValue.status?.id ?? '';
  }
}, { immediate: true, deep: true });

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
    // Only update if changed
    const promises = [];
    if (roleId.value && roleId.value !== props.user.role?.id) {
      promises.push(changeRole(props.user.id, roleId.value));
    }
    if (statusId.value && statusId.value !== props.user.status?.id) {
      promises.push(changeStatus(props.user.id, statusId.value));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      toast.success('Permisos actualizados correctamente');
      emit('saved');
    } else {
      toast.info('No hay cambios para guardar');
    }
    closeDialog();
  } catch (error: any) {
    console.error(error);
    toast.error(error.message || 'Error al actualizar permisos');
  } finally {
    isSubmitting.value = false;
  }
};

defineExpose({ openDialog, closeDialog });
</script>

<template>
  <dialog ref="dialogRef" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Cambiar Permisos</h3>
      <p class="text-sm text-base-content/70 mb-4" v-if="user">Usuario: {{ user.email }}</p>

      <form @submit.prevent="handleSubmit">
        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">Rol</span>
          </label>
          <select v-model="roleId" class="select select-bordered w-full">
            <option value="" disabled>Selecciona un rol</option>
            <option :value="1">Admin</option>
            <option :value="2">User</option>
          </select>
        </div>

        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">Estado</span>
          </label>
          <select v-model="statusId" class="select select-bordered w-full">
            <option value="" disabled>Selecciona un estado</option>
            <option :value="1">Activo</option>
            <option :value="2">Inactivo</option>
          </select>
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
