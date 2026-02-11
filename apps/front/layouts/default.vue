<script setup lang="ts">
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { Separator } from '@/components/ui/separator'
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from '@/components/ui/sidebar/index'
import BreadcrumbCustom from '~/components/base/BreadcrumbCustom.vue'
import LangButton from '~/components/LangButton.vue'
// const description = 'A sidebar that collapses to icons.'
// const iframeHeight = '800px'
// const containerClass = 'w-full h-full'

const route = useRoute()

function setLinks() {
  if (route.fullPath === '/') {
    return [{ title: 'Home', href: '/' }]
  }

  const segments = route.fullPath.split('/').filter(item => item !== '')

  const breadcrumbs = segments.map((item, index) => {
    const str = item.replace(/-/g, ' ')
    const title = str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')

    return {
      title,
      href: `/${segments.slice(0, index + 1).join('/')}`,
    }
  })

  return [{ title: 'Home', href: '/' }, ...breadcrumbs]
}

const links = ref<{
  title: string
  href: string
}[]>(setLinks())

watch(() => route.fullPath, (val) => {
  if (val) {
    links.value = setLinks()
  }
})

</script>

<template>
    <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
            <header
                class="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                <div class="flex items-center gap-2 px-4">
                    <SidebarTrigger class="-ml-1" />
                    <Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
                    <BreadcrumbCustom :links="links" />
                </div>
                <div class="flex items-center">
                  <LangButton />
                  <ColorButton />
                </div>
            </header>
            <div class="container mx-auto px-4">
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