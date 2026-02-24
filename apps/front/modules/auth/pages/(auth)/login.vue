<script setup lang="ts">
definePageMeta({
  layout: "blank",
  middleware: 'guest',
});
</script>

<template>
  <AuthLayout reverse>
    <div class="grid mx-auto max-w-sm gap-6">
      <div class="grid gap-2 text-center">
        <h1 class="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
          <AppLogo />
        </h1>
        <p class="text-balance text-sm text-base-content/60">
          Inicia sesión para entrar en tu cuenta
        </p>
      </div>
      
      <AuthSignIn />
      
      <p class="text-center mt-5 text-xs text-base-content/60">
        Al iniciar sesión confirmas que has leído, comprendes y aceptas nuestros
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
