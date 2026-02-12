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

// Flatten all menu items recursively to include sub-items in search
function flattenNavItems(items: any[]): any[] {
  const result: any[] = []
  items.forEach((item) => {
    if (item.link) {
      result.push(item)
    }
    if (item.children) {
      result.push(...flattenNavItems(item.children))
    }
  })
  return result
}

const allItems = computed(() => {
  const flattened: any[] = []
  navMenu.value.forEach((group) => {
    flattened.push(...flattenNavItems(group.items))
  })
  return flattened
})

// Define shortcuts based on all available menu items
const defineMenuShortcuts = () => {
  const shortcuts: Record<string, () => void> = {
    'G-H': () => navigateTo(homeRoute.value),
  }
  allItems.value.forEach((item: any) => {
    if (item.shortcut && item.link) {
      shortcuts[item.shortcut] = () => navigateTo(item.link)
    }
  })
  return shortcuts
}

// Keep shortcuts in sync
watch(allItems, () => {
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
      <CommandGroup>
        <CommandItem v-for="nav in allItems" :key="nav.link" :value="nav.title" class="gap-2"
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
