<script setup lang="ts">
import type { NavGroup, NavLink, NavMenu } from '~/types/nav'
import { navMenu } from '@/constants/menus'

const { metaSymbol } = useShortcuts()

const openCommand = ref(false)
const router = useRouter()

defineShortcuts({
  Meta_K: () => openCommand.value = true,
})

// Define shortcuts based on menu configuration
const defineMenuShortcuts = () => {
  const shortcuts: Record<string, () => void> = {
    // Main shortcuts
    'G-H': () => navigateTo('/')
  }
  
  // Add admin shortcuts from menu configuration
  const adminItems = navMenu
    .find((nav: NavMenu) => nav.heading === 'Admin')
    ?.items || []
    
  adminItems.forEach((item: NavLink) => {
    if (item.shortcut && item.link) {
      shortcuts[item.shortcut] = () => navigateTo(item.link)
    }
  })
  
  return shortcuts
}

defineShortcuts(defineMenuShortcuts())

const adminItems = computed<NavLink[]>(() => {
  return navMenu
    .find((nav: NavMenu) => nav.heading === 'Admin')
    ?.items || []
})



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
      <CommandGroup heading="Admin">
        <CommandItem
          v-for="nav in adminItems"
          :key="nav.title"
          :value="nav.title"
          class="gap-2"
          @select="handleSelectLink(nav.link)"
        >
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

<style scoped>

</style>
