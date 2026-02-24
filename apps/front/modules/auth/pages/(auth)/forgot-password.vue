<script setup lang="ts">
definePageMeta({
  layout: 'blank',
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-6 bg-base-300 p-6 min-h-svh md:p-10">
    <div class="max-w-md w-full flex flex-col gap-6">
      <NuxtLink to="/" class="flex items-center self-center gap-2 font-medium">
        <AppLogo />
      </NuxtLink>
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body gap-8 p-8 sm:p-12">
          <div class="text-center space-y-2">
            <h2 class="card-title text-3xl justify-center font-bold">
              Contraseña olvidada
            </h2>
            <p class="text-sm text-base-content/60">
              Introduce tu correo electrónico para restablecer tu contraseña
            </p>
          </div>

          <AuthForgotPassword />

          <p class="text-center text-sm text-base-content/60">
            ¿Tienes una cuenta?
            <NuxtLink to="/login" class="link link-primary no-underline font-medium">
              Iniciar sesión
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
