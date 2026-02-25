<script setup lang="ts">
import type { NavLink } from '~/types/nav'
import AppIcon from '../AppIcon.vue';

withDefaults(defineProps<{
  item: NavLink
  size?: any
}>(), {
  size: 'default',
})

const closeDrawer = () => {
  if (typeof document !== 'undefined') {
    const el = document.getElementById('main-drawer') as HTMLInputElement
    if (el) el.checked = false
  }
}
</script>

<template>
  <li>
    <NuxtLink
      :to="item.link"
      exact-active-class="active bg-gradient-to-r from-primary/10 to-primary"
    >
      <template #default="{ isExactActive }">
        <button class="is-drawer-close:tooltip is-drawer-close:tooltip-right gap-2 w-full flex items-center" :data-tip="item.title">
          <AppIcon :name="item.icon || ''" mode="svg" class="size-5" :class="[isExactActive ? 'text-primary' : '']" />
          <span class="is-drawer-close:hidden" :class="[isExactActive ? 'text-primary-content' : '']">{{ item.title }}</span>
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
