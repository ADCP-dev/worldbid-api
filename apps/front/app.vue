<script setup lang="ts">
import { Toaster } from 'vue-sonner'

const i18n = useI18n()
const config = useRuntimeConfig()

// Industrial-dark theme is the only theme now; pin it on <html> so
// @nuxtjs/color-mode's class toggling can't fall back to a light theme.
const themeColor = '#0A0A0A'

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: themeColor },
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
  ],
  htmlAttrs: {
    lang: i18n.locale.value,
    'data-theme': 'luxury-dark',
  },
})

useSeo()

const toastOptions = {
  unstyled: true,
  classes: {
    toast: 'alert shadow-lg border !rounded-box',
    title: 'font-bold',
    description: 'text-sm opacity-90',
    actionButton: 'btn btn-primary btn-sm',
    cancelButton: 'btn btn-ghost btn-sm',
    success: 'alert-success !text-success-content',
    error: 'alert-error !text-error-content',
    info: 'alert-info !text-info-content',
    warning: 'alert-warning !text-warning-content',
    default: 'bg-base-100 text-base-content',
  },
}
</script>

<template>
  <div class="min-h-screen bg-base-100 text-base-content font-sans antialiased">

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <Toaster :toast-options="toastOptions" />
    <template v-if="config.public.env !== 'production'">
      <TranslationDevToggle />
      <InteractiveTranslationEditor />
    </template>
  </div>
</template>
