<script setup lang="ts">
import PasswordInput from '~/components/PasswordInput.vue'
import { toast } from 'vue-sonner';

const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(false)
const email = ref('')
const password = ref('')

async function onSubmit(event: Event) {
  event.preventDefault()

  if (!email.value || !password.value) {
    toast.error('Error', {
      description: 'Por favor introduce el email y la contraseña',
    })
    return
  }

  isLoading.value = true

  try {
    const result = await authStore.login(email.value, password.value)

    if (result.success) {
      toast.success('Bienvenido', {
        description: 'Has iniciado sesión correctamente',
      })

      const { navigateHome } = useHomeRoute()
      navigateHome()
    } else {
      toast.error('Error', {
        description: result.error || 'Credenciales inválidas',
      })
    }
  } catch (error: any) {
    toast.error('Error', {
      description: error?.message || 'Error al iniciar sesión',
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <form class="grid gap-6" @submit="onSubmit">
    <div class="divider">Or continue with</div>
    
    <FormInput
      label="Email"
      v-model="email"
      type="email"
      placeholder="name@example.com"
      :disabled="isLoading"
    />

    <div class="form-control w-full">
      <div class="label justify-between">
        <span class="label-text font-semibold">Contraseña</span>
        <NuxtLink to="/forgot-password" class="label-text-alt link link-hover">
          ¿Olvidaste tu contraseña?
        </NuxtLink>
      </div>
      <PasswordInput id="password" v-model="password" />
    </div>

    <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
      <span v-if="isLoading" class="loading loading-spinner loading-sm" />
      Iniciar sesión
    </button>
  </form>
  <div class="mt-4 text-center text-sm opacity-60">
    ¿No tienes una cuenta?
    <NuxtLink to="/register" class="link font-medium">
      Regístrate
    </NuxtLink>
  </div>
</template>

<style scoped></style>
