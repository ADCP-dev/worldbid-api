<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useRouter, useRoute } from 'vue-router'
import PasswordInput from '~/components/PasswordInput.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const hash = computed(() => route.query.hash as string)
const expires = computed(() => route.query.expires as string)

const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)

const isExpired = computed(() => {
  if (!expires.value) return false
  return Date.now() > Number(expires.value)
})

async function onSubmit(event: Event) {
  event.preventDefault()

  if (!hash.value) {
    toast.error('Enlace inválido', {
      description: 'El enlace de restablecimiento no es válido.',
    })
    return
  }

  if (isExpired.value) {
    toast.error('Enlace expirado', {
      description: 'El enlace de restablecimiento ha expirado. Solicita uno nuevo.',
    })
    return
  }

  if (!password.value || password.value.length < 6) {
    toast.error('Contraseña inválida', {
      description: 'La contraseña debe tener al menos 6 caracteres.',
    })
    return
  }

  if (password.value !== confirmPassword.value) {
    toast.error('Las contraseñas no coinciden', {
      description: 'Por favor asegúrate de que ambas contraseñas sean iguales.',
    })
    return
  }

  isLoading.value = true

  try {
    const result = await authStore.resetPassword(hash.value, password.value)

    if (result.success) {
      toast.success('Contraseña actualizada', {
        description: 'Tu contraseña ha sido restablecida correctamente. Ya puedes iniciar sesión.',
      })
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } else {
      toast.error('Error', {
        description: result.error || 'No se pudo restablecer la contraseña.',
      })
    }
  } catch (error: any) {
    toast.error('Error', {
      description: error?.message || 'Error al restablecer la contraseña.',
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div>
    <!-- Expired link warning -->
    <div v-if="isExpired" class="alert alert-error mb-4 text-sm">
      <span>
        Este enlace ha expirado. Por favor
        <NuxtLink to="/forgot-password" class="link font-medium">
          solicita uno nuevo
        </NuxtLink>.
      </span>
    </div>

    <form v-else @submit="onSubmit">
      <div class="grid gap-4">
        <!-- New password -->
        <div class="form-control w-full">
          <label class="label" for="password">
            <span class="label-text font-semibold">Nueva contraseña</span>
          </label>
          <PasswordInput
            id="password"
            v-model="password"
            placeholder="••••••••"
            auto-complete="new-password"
            :disabled="isLoading"
          />
        </div>

        <!-- Confirm password -->
        <div class="form-control w-full">
          <label class="label" for="confirm-password">
            <span class="label-text font-semibold">Confirmar contraseña</span>
          </label>
          <PasswordInput
            id="confirm-password"
            v-model="confirmPassword"
            placeholder="••••••••"
            auto-complete="new-password"
            :disabled="isLoading"
          />
        </div>

        <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
          <span v-if="isLoading" class="loading loading-spinner loading-sm" />
          Restablecer contraseña
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped></style>
