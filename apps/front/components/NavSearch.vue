<script setup lang="ts">
import { useNavMenu } from '~/composables/useNavMenu'
import { computed, ref, watch } from 'vue'

const { metaSymbol } = useShortcuts()

const openCommand = ref(false)
const searchQuery = ref('')
const { route: homeRoute } = useHomeRoute()

defineShortcuts({
  Meta_K: () => {
    openCommand.value = true
    searchQuery.value = ''
  },
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

const filteredItems = computed(() => {
  if (!searchQuery.value) return allItems.value
  const query = searchQuery.value.toLowerCase()
  return allItems.value.filter(item => item.title.toLowerCase().includes(query))
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
  searchQuery.value = ''
}

</script>

<template>
  <li>
    <button class="btn btn-outline btn-sm text-xs w-full justify-start border-base-content/20" @click="openCommand = !openCommand">
      <AppIcon name="Search" class="size-4" />
      <span class="font-normal flex-1 text-left">Buscar...</span>
      <div class="ml-auto flex items-center gap-1 opacity-50">
        <kbd class="kbd kbd-sm">{{ metaSymbol }}</kbd>
        <kbd class="kbd kbd-sm">K</kbd>
      </div>
    </button>
  </li>

  <Teleport to="body">
    <dialog class="modal sm:modal-middle modal-top z-[999]" :class="{ 'modal-open': openCommand }">
      <div class="modal-box p-0 overflow-hidden flex flex-col h-[80vh] max-h-[400px] mt-16 sm:mt-0">
        <div class="p-4 border-b border-base-300">
          <input
            type="text"
            placeholder="Buscar..."
            class="input input-bordered w-full"
            v-model="searchQuery"
            autofocus
          />
        </div>

        <div v-if="filteredItems.length === 0" class="p-6 text-center text-sm opacity-60">
          No se encontraron resultados
        </div>

        <ul v-else class="menu flex-1 overflow-y-auto w-full p-2 flex-nowrap">
          <li v-for="nav in filteredItems" :key="nav.link">
            <a class="flex items-center gap-2" @click="handleSelectLink(nav.link)">
              <AppIcon :name="nav.icon || 'Circle'" class="size-4 opacity-70" />
              <span class="flex-1">{{ nav.title }}</span>
              <div v-if="nav.shortcut" class="flex gap-1 opacity-50">
                <kbd class="kbd kbd-sm">{{ nav.shortcut.split('-')[0] }}</kbd>
                <kbd class="kbd kbd-sm">{{ nav.shortcut.split('-')[1] }}</kbd>
              </div>
            </a>
          </li>
        </ul>
      </div>
      <form method="dialog" class="modal-backdrop" @click.prevent="openCommand = false">
        <button>close</button>
      </form>
    </dialog>
  </Teleport>
</template>

<style scoped></style>
