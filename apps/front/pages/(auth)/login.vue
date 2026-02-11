<script setup lang="ts">
import logo from "@/assets/imgs/logo/logo_mini.png";

definePageMeta({
  layout: "blank",
});
</script>

<template>
  <LayoutAuth reverse>
    <div class="grid mx-auto max-w-sm gap-6">
      <div class="grid gap-2 text-center">
        <h1 class="text-2xl font-semibold tracking-tight flex items-center justify-center gap-2">
          <img :src="logo" class="size-6 inline bg-white rounded-full" alt="ACME" >

          ACME
        </h1>
        <p class="text-balance text-sm text-muted-foreground">
          Inicia sesión para entrar en tu cuenta
        </p>
      </div>
      <AuthSignIn />
      <p class="text-center mt-5 text-xs">
        Al iniciar sesión confirmas que has leído, comprendes y aceptas nuestros
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
