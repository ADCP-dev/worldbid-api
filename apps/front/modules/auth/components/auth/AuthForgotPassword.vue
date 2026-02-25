<script setup lang="ts">
import { toast } from 'vue-sonner';
import { useRouter } from 'vue-router'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const isLoading = ref(false)
const isSuccess = ref(false)

async function onSubmit(event: Event) {
  event.preventDefault()

  if (!email.value) {
    toast.error('Error', {
      description: 'Por favor introduce tu correo electrónico',
    })
    return
  }

  isLoading.value = true

  try {
    const result = await authStore.forgotPassword(email.value)

    if (result.success) {
      isSuccess.value = true
      toast.success('Correo enviado', {
        description: 'Se ha enviado un correo electrónico con instrucciones para restablecer tu contraseña',
      })

      // Optionally redirect after a delay
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } else {
      toast.error('Error', {
        description: result.error || 'No se pudo enviar el correo de recuperación',
      })
    }
  } catch (error: any) {
    toast.error('Error', {
      description: error?.message || 'Error al solicitar restablecimiento de contraseña',
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <form @submit="onSubmit">
    <div class="grid gap-4">
      <FormInput
        label="Email"
        v-model="email"
        placeholder="name@example.com"
        type="email"
        :disabled="isLoading"
        required
      />
      <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
        <span v-if="isLoading" class="loading loading-spinner loading-sm" />
        Enviar
      </button>
    </div>
  </form>
</template>

<style scoped></style>
