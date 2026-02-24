<script setup lang="ts">
definePageMeta({
  layout: "blank",
});
</script>

<template>
  <AuthLayout>
    <div class="grid mx-auto max-w-sm gap-6">
      <div class="flex flex-col text-center space-y-2">
        <h1 class="text-2xl font-bold tracking-tight">Registro</h1>
        <p class="text-sm text-base-content/60">
          Introduce tus datos para crear tu cuenta
        </p>
      </div>
      
      <AuthSignUp />
      
      <p class="text-center text-sm text-base-content/60">
        ¿Tienes una cuenta?
        <NuxtLink to="/login" class="link link-primary no-underline font-medium">
          Iniciar sesión
        </NuxtLink>
      </p>
      
      <p class="text-center mt-5 text-xs text-base-content/60">
        Al registrarte confirmas que has leído, comprendes y aceptas nuestros
        <a href="https://ACME.com/terms-of-use.html" class="link link-primary no-underline">Términos y
          Condiciones</a>, así como nuestra
        <a href="https://ACME.com/privacy-policy.html" class="link link-primary no-underline">Política de
          Privacidad</a>. Copyright © {{ new Date().getFullYear() }}
        <a href="https://ACME.com" class="link link-primary no-underline">ACME Coorporate, S.L.</a>.
        Todos los derechos reservados.
      </p>
    </div>
  </AuthLayout>
</template>

<style scoped></style>
