<script setup lang="ts">
definePageMeta({
  layout: "blank",
});
</script>

<template>
  <LayoutAuth>
    <div class="grid mx-auto max-w-sm gap-6">
      <div class="flex flex-col text-center space-y-2">
        <h1 class="text-2xl font-semibold tracking-tight">Registro</h1>
        <p class="text-sm text-muted-foreground">
          Introduce tus datos para crear tu cuenta
        </p>
      </div>
      <AuthSignUp />
      <p class="text-center text-sm text-muted-foreground">
        ¿Tienes una cuenta?
        <NuxtLink
          to="/login"
          class="underline underline-offset-4 hover:text-primary"
        >
          Iniciar sesión
        </NuxtLink>
      </p>
      <p class="text-center mt-5 text-xs">
        Al registrarte confirmas que has leído, comprendes y aceptas nuestros
        <a
          href="https://ACME.com/terms-of-use.html"
          class="underline hover:no-underline text-primary-500"
          >Términos y Condiciones</a
        >, así como nuestra
        <a
          href="https://ACME.com/privacy-policy.html"
          class="underline hover:no-underline text-primary-500"
          >Política de Privacidad</a
        >. Copyright © {{ new Date().getFullYear() }}
        <a
          href="https://ACME.com"
          class="underline hover:no-underline text-primary-500"
          >ACME Coorporate, S.L.</a
        >. Todos los derechos reservados.
      </p>
    </div>
  </LayoutAuth>
</template>

<style scoped></style>
