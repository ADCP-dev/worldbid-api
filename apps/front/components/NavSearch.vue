<script setup lang="ts">
import { useNavMenu } from '~/composables/useNavMenu'
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { onClickOutside } from '@vueuse/core'

const { metaSymbol } = useShortcuts()

const openCommand = ref(false)
const searchQuery = ref('')
const activeIndex = ref(0)
const modalRef = ref<HTMLElement | null>(null)
const resultsListRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const { route: homeRoute } = useHomeRoute()

defineShortcuts({
  Meta_K: () => {
    openCommand.value = true
    searchQuery.value = ''
    activeIndex.value = 0
    nextTick(() => {
      inputRef.value?.focus()
    })
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

watch(filteredItems, () => {
  activeIndex.value = 0
})

// Use window-level keydown listener when modal is open
function handleGlobalKeydown(event: KeyboardEvent) {
  if (!openCommand.value) return

  const len = filteredItems.value.length
  if (len === 0) return

  if (event.key === 'ArrowDown') {
    activeIndex.value = (activeIndex.value + 1) % len
    event.preventDefault()
    scrollActiveIntoView()
  } else if (event.key === 'ArrowUp') {
    activeIndex.value = (activeIndex.value - 1 + len) % len
    event.preventDefault()
    scrollActiveIntoView()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const activeItem = filteredItems.value[activeIndex.value]
    if (activeItem) {
      handleSelectLink(activeItem.link)
    }
  }
}

// Register global listener
onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

function scrollActiveIntoView() {
  nextTick(() => {
    const activeEl = resultsListRef.value?.querySelector('.active')
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  })
}

function handleSelectLink(link: string) {
  navigateTo(link)
  openCommand.value = false
  searchQuery.value = ''
}

// Close on click outside using VueUse
onClickOutside(modalRef, () => {
  openCommand.value = false
})

function handleOpenModal() {
  openCommand.value = true
  nextTick(() => {
    inputRef.value?.focus()
  })
}
</script>

<template>
  <li>
    <button
      class="btn btn-outline btn-sm text-xs w-full is-drawer-close:justify-center justify-start border-base-content/20 is-drawer-close:btn-circle"
      :class="{ 'is-drawer-close:btn-ghost': !openCommand }"
      @click="handleOpenModal"
    >
      <AppIcon name="Search" class="size-4" />
      <span class="font-normal flex-1 text-left is-drawer-close:hidden">{{ $t('mod.nav.searchPlaceholder') }}</span>
      <div class="ml-auto flex items-center gap-1 opacity-50 is-drawer-close:hidden">
        <kbd class="kbd kbd-sm">{{ metaSymbol }}</kbd>
        <kbd class="kbd kbd-sm">K</kbd>
      </div>
    </button>
  </li>

  <Teleport to="body">
    <dialog class="modal sm:modal-middle modal-top z-[999]" :class="{ 'modal-open': openCommand }">
      <div ref="modalRef" class="modal-box p-0 overflow-hidden flex flex-col h-[80vh] max-h-[400px] mt-16 sm:mt-0">
        <div class="p-4 border-b border-base-300">
          <input
            ref="inputRef"
            v-model="searchQuery"
            type="text"
            :placeholder="$t('mod.nav.searchPlaceholder')"
            class="input input-bordered w-full"
          >
        </div>

        <div v-if="filteredItems.length === 0" class="p-6 text-center text-sm opacity-60">
          {{ $t('mod.nav.noResults') }}
        </div>

        <ul v-else ref="resultsListRef" class="menu flex-1 overflow-y-auto w-full p-2 flex-nowrap">
          <li v-for="(nav, index) in filteredItems" :key="nav.link">
            <a
              class="flex items-center gap-2"
              :class="{ 'bg-primary text-primary-content': activeIndex === index }"
              @click="handleSelectLink(nav.link)"
              @mouseenter="activeIndex = index"
            >
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
