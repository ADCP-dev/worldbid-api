<script setup lang="ts">
import type { NavLink } from '~/types/nav'
import AppIcon from '../AppIcon.vue';

withDefaults(defineProps<{
  item: NavLink
  size?: any
}>(), {
  size: 'default',
})

// const closeDrawer = () => {
//   if (typeof document !== 'undefined') {
//     const el = document.getElementById('main-drawer') as HTMLInputElement
//     if (el) el.checked = false
//   }
// }
</script>

<template>
  <li>
    <NuxtLink
      :to="item.link"
      class="rounded-md"
      exact-active-class="border-l-2 border-l-primary bg-primary/10"
    >
      <template #default>
        <button class="is-drawer-close:tooltip is-drawer-close:tooltip-right gap-2 w-full flex items-center is-drawer-close:justify-center" :data-tip="item.title">
          <AppIcon :name="item.icon || ''" mode="svg" class="size-5" />
          <span class="is-drawer-close:hidden">{{ item.title }}</span>
          <span v-if="item.new" class="ml-auto rounded-md bg-#adfa1d px-1.5 py-0.5 text-xs text-black leading-none no-underline group-hover:no-underline is-drawer-close:hidden">
            New
          </span>
        </button>
      </template>
    </NuxtLink>
  </li>
</template>

<style scoped>

</style>
