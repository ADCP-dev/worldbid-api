<script setup lang="ts">
import { Loader2, Eye, EyeOff } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const hash = computed(() => route.query.hash as string)
const expires = computed(() => route.query.expires as string)

const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const showPassword = ref(false)
const showConfirm = ref(false)

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
    <div v-if="isExpired" class="rounded-md bg-destructive/10 border border-destructive/20 p-4 mb-4 text-sm text-destructive text-center">
      Este enlace ha expirado. Por favor
      <NuxtLink to="/forgot-password" class="font-medium underline underline-offset-2">
        solicita uno nuevo
      </NuxtLink>.
    </div>

    <form v-else @submit="onSubmit">
      <div class="grid gap-4">
        <!-- New password -->
        <div class="grid gap-2">
          <Label for="password">Nueva contraseña</Label>
          <div class="relative">
            <Input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              auto-complete="new-password"
              :disabled="isLoading"
              class="pr-10"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" class="h-4 w-4" />
              <Eye v-else class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- Confirm password -->
        <div class="grid gap-2">
          <Label for="confirm-password">Confirmar contraseña</Label>
          <div class="relative">
            <Input
              id="confirm-password"
              v-model="confirmPassword"
              :type="showConfirm ? 'text' : 'password'"
              placeholder="••••••••"
              auto-complete="new-password"
              :disabled="isLoading"
              class="pr-10"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
              @click="showConfirm = !showConfirm"
            >
              <EyeOff v-if="showConfirm" class="h-4 w-4" />
              <Eye v-else class="h-4 w-4" />
            </button>
          </div>
        </div>

        <Button type="submit" :disabled="isLoading" class="w-full">
          <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
          Restablecer contraseña
        </Button>
      </div>
    </form>
  </div>
</template>

<style scoped></style>
