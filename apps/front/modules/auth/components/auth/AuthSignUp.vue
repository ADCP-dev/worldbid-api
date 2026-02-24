<script setup lang="ts">
import PasswordInput from "~/components/PasswordInput.vue";
import { toast } from 'vue-sonner';

const router = useRouter();
const authStore = useAuthStore();

const name = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const isLoading = ref(false);

async function onSubmit(event: Event) {
  event.preventDefault();

  // Form validation
  if (!name.value || !email.value || !password.value || !confirmPassword.value) {
    toast.error('Error', {
      description: 'Por favor completa todos los campos',
    });
    return;
  }

  if (password.value !== confirmPassword.value) {
    toast.error('Error', {
      description: 'Las contraseñas no coinciden',
    });
    return;
  }

  isLoading.value = true;

  try {
    const [firstName, ...lastNameParts] = name.value.trim().split(' ');
    const result = await authStore.register({
      firstName,
      lastName: lastNameParts.join(' ') || '',
      email: email.value,
      password: password.value,
    });

    if (result.success) {
      toast.success('Cuenta creada', {
        description: 'Tu cuenta ha sido creada correctamente',
      });

      const { navigateHome } = useHomeRoute();
      navigateHome();
    } else {
      toast.error('Error', {
        description: result.error || 'Error al crear la cuenta',
      });
    }
  } catch (error: any) {
    toast.error('Error', {
      description: error?.message || 'Error al registrarse',
    });
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div :class="['grid gap-6', $attrs.class ?? '']">
    <form @submit="onSubmit">
      <div class="grid gap-4">
        <FormInput
          label="Nombre"
          v-model="name"
          placeholder="Introduce tu nombre"
          :disabled="isLoading"
          required
        />
        
        <FormInput
          label="Email"
          v-model="email"
          placeholder="Introduce tu correo electrónico"
          type="email"
          :disabled="isLoading"
          required
        />

        <div class="form-control w-full">
          <label class="label">
            <span class="label-text font-semibold">Contraseña</span>
          </label>
          <PasswordInput
            id="password"
            v-model="password"
            placeholder="Introduce tu contraseña"
            :disabled="isLoading"
          />
        </div>

        <div class="form-control w-full">
          <label class="label">
            <span class="label-text font-semibold">Confirmar Contraseña</span>
          </label>
          <PasswordInput
            id="confirm-password"
            v-model="confirmPassword"
            placeholder="Confirma tu contraseña"
            :disabled="isLoading"
          />
        </div>

        <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
          <span v-if="isLoading" class="loading loading-spinner loading-sm" />
          Registrarme
        </button>
      </div>
    </form>
  </div>
</template>
