<script setup lang="ts">
import AppSidebar from '@/components/layout/AppSidebar.vue'
import Header from '@/components/layout/Header.vue'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar/index'
import LangButton from '~/components/LangButton.vue'

</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <Header>
        <div class="flex items-center">
          <LangButton />
          <ColorButton />
        </div>
      </Header>
      <div class="container mx-auto px-4 py-6">
        <Transition name="fade" mode="out-in">
          <slot />
        </Transition>
      </div>
    </SidebarInset>
  </SidebarProvider>
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