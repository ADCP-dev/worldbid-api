<script setup lang="ts">
import { Toaster } from 'vue-sonner'

const colorMode = useColorMode()
const i18n = useI18n()
const config = useRuntimeConfig()

const color = computed(() => colorMode.value === 'dark' ? '#09090b' : '#ffffff')


useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color },
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
  ],
  htmlAttrs: {
    lang: i18n.locale.value,
  },
})

// const title = ''
// const description = ''

// useSeoMeta({
//   title,
//   description,
//   ogTitle: title,
//   ogDescription: description,
//   ogUrl: '',
//   ogImage: '',
//   twitterTitle: title,
//   twitterDescription: description,
//   twitterImage: '',
//   twitterCard: 'summary_large_image',
// })

// const router = useRouter()

// defineShortcuts({
//   'G-H': () => navigateTo('/'),
//   'G-E': () => navigateTo('/email'),
// })
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
