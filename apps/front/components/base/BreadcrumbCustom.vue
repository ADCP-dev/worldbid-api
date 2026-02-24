<script setup lang="ts">
interface Links {
  title: string
  href: string
}
withDefaults(defineProps<{
  links: Links[]
  separator?: string
}>(), {
  separator: 'ChevronRight',
})
</script>

<template>
  <div class="breadcrumbs text-sm text-base-content/60">
    <ul>
      <li v-for="(link, index) in links" :key="index">
        <NuxtLink v-if="index !== links.length - 1" :to="link.href" class="hover:text-primary transition-colors flex items-center gap-1">
          {{ link.title }}
        </NuxtLink>
        <span v-else class="text-base-content font-bold">
          {{ link.title }}
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>

</style>
