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
          {{ $t('base.auth.loginPage.description') }}
        </p>
      </div>

      <AuthSignIn />

      <p class="text-center mt-5 text-xs text-base-content/60" v-html="$t('base.auth.terms.login', { year: new Date().getFullYear() })"/>
    </div>
  </AuthLayout>
</template>
