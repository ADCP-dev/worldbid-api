<script setup lang="ts">
definePageMeta({
  layout: "blank",
});
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-6 bg-base-200 p-6 min-h-svh md:p-10">
    <div class="max-w-sm w-full flex flex-col gap-6">
      <NuxtLink to="/" class="flex items-center self-center gap-2 font-medium">
        <AppLogo />
      </NuxtLink>
      
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body gap-6">
          <div class="text-center space-y-2">
            <h2 class="card-title text-2xl font-bold justify-center">
              Restablecer contraseña
            </h2>
            <p class="text-sm text-base-content/60">
              Introduce tu nueva contraseña para continuar
            </p>
          </div>
          
          <AuthResetPassword />
          
          <p class="text-center text-sm text-base-content/60">
            ¿Recuerdas tu contraseña?
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
