<script setup lang="ts">
import logo from '@/assets/imgs/logo/logo_mini.png'
definePageMeta({
  layout: 'blank',
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-6 bg-muted p-6 min-h-svh md:p-10">
    <div class="max-w-sm w-full flex flex-col gap-6">
      <NuxtLink to="#" class="flex items-center self-center gap-2 font-medium">
        <div class="h-6 w-6 flex items-center justify-center rounded-md bg-white text-primary-foreground">
          <img :src="logo" class="size-6" alt="ACME">
        </div>
        ACME
      </NuxtLink>
      <Card>
        <CardHeader class="text-center">
          <CardTitle class="text-xl">
            Contraseña olvidada
          </CardTitle>
          <CardDescription>
            Introduce tu correo electrónico para restablecer tu contraseña
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid mx-auto max-w-sm gap-6">
            <AuthForgotPassword />
            <p class="text-center text-sm text-muted-foreground">
              ¿Tienes una cuenta?
              <NuxtLink
                to="/login"
                class="underline underline-offset-4 hover:text-primary"
              >
                Iniciar sesión
              </NuxtLink>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>

</style>
