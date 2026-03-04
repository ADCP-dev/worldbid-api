<script setup lang="ts">

interface Item {
  title: string
  href: string
}

const route = useRoute()

const sidebarNavItems: Item[] = [
  {
    title: 'Profile',
    href: '/app/settings/profile',
  },
]
</script>

<template>
  <nav class="flex lg:flex-col gap-1">
    <NuxtLink
      v-for="item in sidebarNavItems"
      :key="item.title"
      :to="item.href"
      class="btn btn-ghost justify-start w-full text-left rounded-none rounded-r-sm border-l-1"
      :class="[route.path === item.href ? 'text-primary-content border-l-primary bg-primary/10' : 'border-l-transparent']"
    >
      {{ item.title }}
    </NuxtLink>
  </nav>
</template>
