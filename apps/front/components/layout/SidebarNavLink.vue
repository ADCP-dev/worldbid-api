<script setup lang="ts">
import type { SidebarMenuButtonVariants } from '~/components/ui/sidebar'
import type { NavLink } from '~/types/nav'
import { useSidebar } from '~/components/ui/sidebar'
import AppIcon from '../AppIcon.vue';

withDefaults(defineProps<{
  item: NavLink
  size?: SidebarMenuButtonVariants['size']
}>(), {
  size: 'default',
})

const { setOpenMobile } = useSidebar()
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton as-child :tooltip="item.title" :size="size">
        <NuxtLink
          :to="item.link"
          :exact-active-class="'bg-gradient-to-r from-primary/10 dark:from-primary/20 to-transparent'" 
          class="flex items-center gap-3"
          @click="setOpenMobile(false)"
        >
          <template #default="{ isExactActive }">
              <AppIcon :name="item.icon || ''" mode="svg" :class="[isExactActive ? 'text-primary dark:text-primary' : '']" />
              <span :class="[isExactActive ? 'text-primary dark:text-primary' : '']">{{ item.title }}</span>
              <span v-if="item.new" class="ml-auto rounded-md bg-#adfa1d px-1.5 py-0.5 text-xs text-black leading-none no-underline group-hover:no-underline">
                New
              </span>
          </template>
        </NuxtLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</template>

<style scoped>

</style>
