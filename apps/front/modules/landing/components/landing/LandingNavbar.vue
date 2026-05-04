<script lang="ts" setup>
import { Menu } from "lucide-vue-next";
import { ref } from "vue";
import { useColorMode } from "@vueuse/core";

const colorMode = useColorMode();
const localePath = useLocalePath();

interface RouteProps {
  href: string;
  label: string;
}

const routeList: RouteProps[] = [
  { href: "#benefits", label: "Beneficios" },
  { href: "#features", label: "Características" },
  { href: "#services", label: "Pilares" },
  { href: "#plans", label: "Planes" },
  { href: "#faq", label: "FAQ" },
];

const isOpen = ref<boolean>(false);
</script>

<template>
  <div class="drawer">
    <input id="landing-drawer" v-model="isOpen" type="checkbox" class="drawer-toggle" >
    <div class="drawer-content flex flex-col items-center">
      <header
:class="{
        'shadow-light': colorMode === 'light',
        'shadow-dark': colorMode === 'dark',
        'container top-5 mx-auto place-items-center lg:max-w-screen-xl gap-8 mx-auto sticky border z-40 px-4 py-2 sm:px-6 rounded-2xl flex justify-between items-center shadow-md backdrop-blur-xl': true,
      }">
        <AppLogo :show-text="false" />

        <!-- Mobile Toggle -->
        <div class="flex items-center lg:hidden">
          <label for="landing-drawer" class="btn btn-ghost btn-circle">
            <Menu class="h-6 w-6" />
          </label>
        </div>

        <!-- Desktop Navigation -->
        <nav class="hidden lg:flex items-center gap-1">
          <a v-for="{ href, label } in routeList" :key="label" :href="href" class="btn btn-ghost btn-sm font-medium">
            {{ label }}
          </a>
        </nav>

        <div class="hidden lg:flex gap-4 items-center">
          <LangButton />
          <NuxtLink :to="localePath('/login')" class="btn btn-outline btn-sm">
            Login
          </NuxtLink>
          <ToggleTheme />
        </div>
      </header>
    </div>

    <!-- Mobile Drawer Side -->
    <div class="drawer-side z-50">
      <label for="landing-drawer" class="drawer-overlay"/>
      <div class="menu p-4 w-80 min-h-full bg-base-200 text-base-content flex flex-col">
        <div class="flex items-center justify-between mb-8">
          <AppLogo />
          <label for="landing-drawer" class="btn btn-ghost btn-sm btn-circle">✕</label>
        </div>

        <ul class="flex-grow gap-2">
          <li v-for="{ href, label } in routeList" :key="label">
            <a :href="href" class="text-lg" @click="isOpen = false">
              {{ label }}
            </a>
          </li>
        </ul>

        <div class="divider"/>

        <div class="flex flex-col gap-4 p-2">
          <NuxtLink :to="localePath('/login')" class="btn btn-primary w-full" @click="isOpen = false">
            Login
          </NuxtLink>
          <div class="flex justify-between items-center px-2">
            <LangButton />
            <LandingToggleTheme />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shadow-light {
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.085);
}

.shadow-dark {
  box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.141);
}
</style>
