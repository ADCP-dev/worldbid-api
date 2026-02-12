<script setup lang="ts">
import type { SidebarProps } from '@/components/ui/sidebar/index'
import { useNavMenu } from '~/composables/useNavMenu'

import NavUser from '~/components/layout/NavUser.vue'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from '@/components/ui/sidebar/index'

import SidebarMenu from '@/components/ui/sidebar/SidebarMenu.vue'
import SidebarMenuItem from '@/components/ui/sidebar/SidebarMenuItem.vue'
import SidebarMenuButton from '@/components/ui/sidebar/SidebarMenuButton.vue'
import AppLogo from '@/components/AppLogo.vue'
import SidebarHeader from '@/components/ui/sidebar/SidebarHeader.vue'
import type { NavGroup, NavLink, NavSectionTitle } from '~/types/nav'
import { NavSearch } from '#components'

const props = withDefaults(defineProps<SidebarProps>(), {
  collapsible: 'icon',
})

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
  name: authStore.user?.firstName + ' ' + authStore.user?.lastName,
  email: authStore.user?.email,
  avatar: authStore.user?.photo?.path,
}
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <AppLogo />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <NavSearch />
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup v-for="(nav, indexGroup) in navMenu" :key="indexGroup">
        <SidebarGroupLabel v-if="nav.heading">
          {{ nav.heading }}
        </SidebarGroupLabel>
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in nav.items" :key="index" :item="item" />
      </SidebarGroup>
      <SidebarGroup class="mt-auto">
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in navMenuBottom" :key="index" :item="item"
          size="sm" />
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <NavUser :user="user" />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
