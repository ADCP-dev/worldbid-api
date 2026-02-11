<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'
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
    toast({
      title: 'Error',
      description: 'Por favor introduce tu correo electrónico',
      variant: 'destructive',
    })
    return
  }
  
  isLoading.value = true
  
  try {
    const success = await authStore.forgotPassword(email.value)
    
    if (success) {
      isSuccess.value = true
      toast({
        title: 'Correo enviado',
        description: 'Se ha enviado un correo electrónico con instrucciones para restablecer tu contraseña',
      })
      
      // Optionally redirect after a delay
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } else {
      toast({
        title: 'Error',
        description: authStore.error || 'No se pudo enviar el correo de recuperación',
        variant: 'destructive',
      })
    }
  } catch (error: any) {
    toast({
      title: 'Error',
      description: error?.message || 'Error al solicitar restablecimiento de contraseña',
      variant: 'destructive',
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <form @submit="onSubmit">
    <div class="grid gap-4">
      <div class="grid gap-2">
        <Label for="email">
          Email
        </Label>
        <Input
          id="email"
          placeholder="name@example.com"
          type="email"
          auto-capitalize="none"
          auto-complete="email"
          auto-correct="off"
          :disabled="isLoading"
        />
      </div>
      <Button :disabled="isLoading">
        <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
        Enviar
      </Button>
    </div>
  </form>
</template>

<style scoped>

</style>
