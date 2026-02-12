<script setup lang="ts">
import BreadcrumbCustom from '~/components/base/BreadcrumbCustom.vue'
import { useHomeRoute } from '~/composables/useHomeRoute'

const route = useRoute()
const { route: homeRoute } = useHomeRoute()

function setLinks() {
  if (route.fullPath === homeRoute.value) {
    return [{ title: 'Home', href: homeRoute.value }]
  }

  const segments = route.fullPath.split('/').filter(item => item !== '')
  const breadcrumbs: { title: string; href: string }[] = []

  let currentPath = ''
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`

    // Skip the 'app' segment if it's the first one
    if (index === 0 && segment === 'app') {
      return
    }

    const str = segment.replace(/-/g, ' ')
    const title = str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')

    breadcrumbs.push({
      title,
      href: currentPath,
    })
  })

  return [{ title: 'Home', href: homeRoute.value }, ...breadcrumbs]
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
  <header class="sticky top-0 z-10 h-60px flex items-center gap-4 border-b py-1 bg-background px-4 md:px-6">
    <div class="w-full flex items-center gap-4">
      <SidebarTrigger />
      <Separator orientation="vertical" class="h-4" />
      <BreadcrumbCustom :links="links" />
    </div>
    <div class="ml-auto">
      <slot />
    </div>
  </header>
</template>

<style scoped></style>
