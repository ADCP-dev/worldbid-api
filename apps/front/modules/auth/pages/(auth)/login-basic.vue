<script setup lang="ts">
definePageMeta({
  layout: 'blank',
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-6 bg-base-200 p-6 min-h-svh md:p-10">
    <div class="max-w-sm w-full flex flex-col gap-6">
      <NuxtLink to="/" class="flex items-center self-center gap-2 font-medium">
        <AppLogo />
      </NuxtLink>
      
      <div class="flex flex-col gap-6">
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body text-center gap-6">
            <div class="space-y-2">
              <h2 class="card-title text-2xl font-bold justify-center">
                Welcome back
              </h2>
              <p class="text-sm text-base-content/60">
                Login with your email or social account
              </p>
            </div>
            
            <AuthSignIn />
          </div>
        </div>

        <div class="text-center text-balance text-xs text-base-content/60">
          By clicking continue, you agree to our 
          <a href="#" class="link link-primary no-underline font-medium">Terms of Service</a>
          and 
          <a href="#" class="link link-primary no-underline font-medium">Privacy Policy</a>.
        </div>
      </div>
    </div>
  </div>
</template>
