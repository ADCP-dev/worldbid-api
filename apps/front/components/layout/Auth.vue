<script setup lang="ts">
import loginImage from '@/assets/imgs/login-image.webp'

defineProps<{
  reverse?: boolean
}>()
</script>

<template>
  <div class="relative flex items-center justify-center px-4 h-dvh lg:max-w-none lg:px-0"
    :class="{ 'flex-row-reverse': reverse }">
    <div class="relative hidden h-full flex-1 flex-col bg-muted p-10 text-white lg:flex dark:border-r">
      <img :src="loginImage" class="absolute inset-0 bg-zinc-900 h-full w-full object-cover">
      <div class="relative z-20 flex items-center text-lg font-medium">
        <AppLogo />
      </div>
      <!-- <div class="relative z-20 mt-auto">
        <blockquote class="space-y-2">
          <p class="text-lg">
            &ldquo;This library has saved me countless hours of work and
            helped me deliver stunning designs to my clients faster than
            ever before.&rdquo;
          </p>
          <footer class="text-sm">
            Sofia Davis
          </footer>
        </blockquote>
      </div> -->
    </div>
    <div class="mx-auto flex-1 lg:p-8">
      <slot />
    </div>
  </div>
</template>

<style scoped></style>
