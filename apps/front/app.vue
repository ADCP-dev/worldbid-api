<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner'

const colorMode = useColorMode()

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
    lang: 'es',
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
</script>

<template>
  <div>  
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
      
    <Toaster class="pointer-events-auto" />
  </div>
</template>
