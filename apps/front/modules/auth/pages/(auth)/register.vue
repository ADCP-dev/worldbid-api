<script setup lang="ts">
definePageMeta({
  layout: "blank",
});
</script>

<template>
  <AuthLayout>
    <div class="grid mx-auto max-w-sm gap-6">
      <div class="flex flex-col text-center space-y-2">
        <h1 class="text-2xl font-bold tracking-tight">{{ $t('base.auth.register.title') }}</h1>
        <p class="text-sm text-base-content/60">
          {{ $t('base.auth.register.description') }}
        </p>
      </div>

      <AuthSignUp />

      <p class="text-center text-sm text-base-content/60">
        {{ $t('base.auth.haveAccount') }}
        <NuxtLink to="/login" class="link link-primary no-underline font-medium">
          {{ $t('base.auth.signIn') }}
        </NuxtLink>
      </p>

      <p class="text-center mt-5 text-xs text-base-content/60" v-html="$t('base.auth.terms.register', { year: new Date().getFullYear() })"></p>
    </div>
  </AuthLayout>
</template>

<style scoped></style>
