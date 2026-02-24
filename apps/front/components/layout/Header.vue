<script setup lang="ts">
import BreadcrumbCustom from '~/components/base/BreadcrumbCustom.vue'


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
  <header class="sticky top-0 z-10 h-[45px] flex items-center gap-4 bg-base-100 border-b px-4">
    <div class="w-full flex items-center gap-4">
      <label for="main-drawer" aria-label="open sidebar" class="btn btn-square btn-ghost btn-sm">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="currentColor" class="size-5"><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"></path><path d="M9 4v16"></path><path d="M14 10l2 2l-2 2"></path></svg>
      </label>
      <div class="flex items-center justify-center">
        <div class="divider divider-horizontal h-4 mx-0"></div>
      </div>
      <BreadcrumbCustom :links="links" />
    </div>
    <div class="ml-auto flex items-center gap-2">
      <slot />
    </div>
  </header>
</template>

<style scoped></style>
