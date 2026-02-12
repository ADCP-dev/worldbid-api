<script setup lang="ts">
import type { NavLink, NavMenu } from '~/types/nav'
import { useNavMenu } from '~/composables/useNavMenu'
import { useHomeRoute } from '~/composables/useHomeRoute'
import { useAuthStore } from '~/stores/auth.store'

const { metaSymbol } = useShortcuts()

const openCommand = ref(false)
const { route: homeRoute } = useHomeRoute()

defineShortcuts({
  Meta_K: () => openCommand.value = true,
})

const { navMenu } = useNavMenu()
const authStore = useAuthStore()

// Dynamic group title based on role
const groupTitle = computed<string>(() => {
  if (authStore.isAdmin) return 'Admin'
  if (authStore.isCustomer) return 'Customer'
  return 'General'
})

// Items for the active role group
const roleItems = computed<NavLink[]>(() => {
  return (
    navMenu.value.find((nav: NavMenu) => nav.heading === groupTitle.value)?.items || []
  )
})

// Define shortcuts based on current role menu
const defineMenuShortcuts = () => {
  const shortcuts: Record<string, () => void> = {
    'G-H': () => navigateTo(homeRoute.value),
  }
  roleItems.value.forEach((item: NavLink) => {
    if (item.shortcut && item.link) {
      shortcuts[item.shortcut] = () => navigateTo(item.link)
    }
  })
  return shortcuts
}

// Keep shortcuts in sync with role changes
watch([groupTitle, roleItems], () => {
  defineShortcuts(defineMenuShortcuts())
}, { immediate: true })



function handleSelectLink(link: string) {
  navigateTo(link)
  openCommand.value = false
}
</script>

<template>
  <SidebarMenuButton as-child tooltip="Search">
    <Button variant="outline" size="sm" class="text-xs" @click="openCommand = !openCommand">
      <AppIcon name="Search" />
      <span class="font-normal group-data-[collapsible=icon]:hidden">Buscar...</span>
      <div class="ml-auto flex items-center space-x-0.5 group-data-[collapsible=icon]:hidden">
        <BaseKbd>{{ metaSymbol }}</BaseKbd>
        <BaseKbd>K</BaseKbd>
      </div>
    </Button>
  </SidebarMenuButton>

  <CommandDialog v-model:open="openCommand">
    <CommandInput placeholder="Buscar..." />
    <CommandList>
      <CommandEmpty>No se encontraron resultados</CommandEmpty>
      <CommandSeparator />
      <CommandGroup :heading="groupTitle">
        <CommandItem v-for="nav in roleItems" :key="nav.title" :value="nav.title" class="gap-2"
          @select="handleSelectLink(nav.link)">
          <AppIcon :name="nav.icon || 'Circle'" />
          {{ nav.title }}
          <CommandShortcut v-if="nav.shortcut">
            <BaseKbd>{{ nav.shortcut.split('-')[0] }}</BaseKbd>
            <BaseKbd>{{ nav.shortcut.split('-')[1] }}</BaseKbd>
          </CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>

<style scoped></style>
