<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()

const lang = computed(() => (route.params.lang as string) || 'es')
</script>

<template>
  <div class="min-h-screen bg-base-100">
    <header class="navbar bg-base-200 shadow">
      <div class="container mx-auto px-4">
        <div class="flex-1">
          <NuxtLink :to="`/${lang}`" class="text-xl font-bold">
            Foundation
          </NuxtLink>
        </div>
        <div class="flex-none gap-2">
          <NuxtLink :to="`/${lang}/blog`" class="btn btn-ghost btn-sm">
            Blog
          </NuxtLink>
          <NuxtLink :to="`/${lang}`" class="btn btn-ghost btn-sm">
            Home
          </NuxtLink>
        </div>
      </div>
    </header>

    <main>
      <slot />
    </main>

    <footer class="footer footer-center p-4 bg-base-200 text-base-content mt-12">
      <aside>
        <p>Foundation Blog</p>
      </aside>
    </footer>
  </div>
</template>
