<script setup lang="ts">
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-vue-next";
import PasswordInput from "~/components/PasswordInput.vue";
import { useAuthStore } from '~/stores/auth.store';
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
  <div :class="cn('grid gap-6', $attrs.class ?? '')">
    <form @submit="onSubmit">
      <div class="grid gap-4">
        <div class="grid gap-2">
          <Label for="name"> Nombre </Label>
          <Input id="name" v-model="name" placeholder="Introduce tu nombre" type="text" auto-capitalize="none"
            auto-complete="name" auto-correct="off" :disabled="isLoading" />
        </div>
        <div class="grid gap-2">
          <Label for="email"> Email </Label>
          <Input id="email" v-model="email" placeholder="Introduce tu correo electrónico" type="email"
            auto-capitalize="none" auto-complete="email" auto-correct="off" :disabled="isLoading" />
        </div>
        <div class="grid gap-2">
          <Label for="password"> Contraseña </Label>
          <PasswordInput id="password" v-model="password" placeholder="Introduce tu contraseña" />
        </div>
        <div class="grid gap-2">
          <Label for="confirm-password"> Confirmar Contraseña </Label>
          <PasswordInput id="confirm-password" v-model="confirmPassword" placeholder="Confirma tu contraseña" />
        </div>
        <Button :disabled="isLoading">
          <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
          Registrarme
        </Button>
      </div>
    </form>
  </div>
</template>
