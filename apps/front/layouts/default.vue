<script setup lang="ts">
import AppSidebar from '@/components/layout/AppSidebar.vue'
import Header from '@/components/layout/Header.vue'
import LangButton from '~/components/LangButton.vue'
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'

const isSidebarOpen = ref(false)
const route = useRoute()

onMounted(() => {
  // Expanded by default on PC (lg: 1024px)
  if (window.innerWidth >= 1024) {
    isSidebarOpen.value = true
  }
})

// Close sidebar on mobile when navigating
watch(() => route.fullPath, () => {
  if (window.innerWidth < 1024) {
    isSidebarOpen.value = false
  }
})
</script>

<template>
  <div class="drawer lg:drawer-open">
    <input id="main-drawer" type="checkbox" class="drawer-toggle" v-model="isSidebarOpen" />
    <div class="drawer-content flex flex-col min-h-screen bg-base-200">
      <Header>
        <div class="flex items-center gap-2">
          <LangButton />
        </div>
      </Header>
      <div class="container mx-auto px-4 py-6 grow">
        <Transition name="fade" mode="out-in">
          <slot />
        </Transition>
      </div>
    </div>
    <div class="drawer-side z-50 is-drawer-close:overflow-visible">
      <label for="main-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
      <AppSidebar />
    </div>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
