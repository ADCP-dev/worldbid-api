<script setup lang="ts">
import { useNavMenu } from '~/composables/useNavMenu'

import NavUser from '~/components/layout/NavUser.vue'
import AppLogo from '@/components/AppLogo.vue'
import type { NavGroup, NavLink, NavSectionTitle } from '~/types/nav'
import { NavSearch } from '#components'

const { navMenu, navMenuBottom } = useNavMenu()

const authStore = useAuthStore()


function resolveNavItemComponent(item: NavLink | NavGroup | NavSectionTitle): any {
  if ('children' in item)
    return resolveComponent('LayoutSidebarNavGroup')

  return resolveComponent('LayoutSidebarNavLink')
}

const user: {
  name: string
  email: string
  avatar: string
} = {
  name: ((authStore.user?.firstName || '') + ' ' + (authStore.user?.lastName || '')).trim(),
  email: authStore.user?.email || '',
  avatar: authStore.user?.photo?.path || '',
}
</script>

<template>
  <div
    class="is-drawer-close:w-16 is-drawer-open:w-72 border-r h-screen bg-base-300 flex flex-col relative transition-all duration-300">
    <label
for="main-drawer"
      class="absolute -right-2 top-0 bottom-0 w-4 cursor-e-resize z-50 hover:bg-primary/10 transition-colors"/>

    <div class="is-drawer-close:p-2 p-4 flex flex-col gap-4 w-full shrink-0">
      <div>
        <AppLogo />
      </div>
      <NavSearch />
    </div>

    <div
      class="flex-1 overflow-x-hidden overflow-y-auto is-drawer-close:overflow-visible w-full is-drawer-close:px-0 px-2 min-h-0">
      <ul v-for="(nav, indexGroup) in navMenu" :key="indexGroup" class="menu w-full gap-1">
        <li v-if="nav.heading" class="menu-title uppercase text-xs font-semibold py-2 is-drawer-close:hidden">
          {{ nav.heading }}
        </li>
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in nav.items" :key="index" :item="item" />
      </ul>
    </div>

    <ul class="menu w-full shrink-0 is-drawer-close:px-0 px-2">
      <component
:is="resolveNavItemComponent(item)" v-for="(item, index) in navMenuBottom" :key="index" :item="item"
        size="sm" />
    </ul>

    <div class="border-t w-full shrink-0">
      <NavUser :user="user" />
    </div>
  </div>
</template>
