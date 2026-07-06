<script setup lang="ts">
interface NavItem {
  title: string;
  href: string;
}

const navItems = useState<NavItem[]>('settings:navItems', () => []);
const route = useRoute();
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
    <aside class="hidden md:block">
      <ul class="menu menu-sm w-full">
        <li v-for="item in navItems" :key="item.href">
          <NuxtLink
            :to="item.href"
            :class="{ active: route.path === item.href }"
          >
            {{ item.title }}
          </NuxtLink>
        </li>
      </ul>
    </aside>
    <main>
      <slot />
    </main>
  </div>
</template>
