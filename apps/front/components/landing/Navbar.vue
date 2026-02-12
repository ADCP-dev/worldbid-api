<script lang="ts" setup>
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { Menu, BotMessageSquare } from "lucide-vue-next";
import ToggleTheme from "./ToggleTheme.vue";
import { ref } from "vue";

import { useColorMode } from "@vueuse/core";
import Logo from "./components/Logo.vue";
const colorMode = useColorMode();
import { useHomeRoute } from "~/composables/useHomeRoute";
const { route: homeRoute } = useHomeRoute();



interface RouteProps {
  href: string;
  label: string;
}

interface FeatureProps {
  title: string;
  description: string;
}

const routeList: RouteProps[] = [
  {
    href: "#benefits",
    label: "Beneficios",
  },
  {
    href: "#features",
    label: "Características",
  },
  {
    href: "#services",
    label: "Pilares",
  },
  {
    href: "#plans",
    label: "Planes",
  },
  {
    href: "#faq",
    label: "FAQ",
  },
];

const featureList: FeatureProps[] = [
  {
    title: "Monorepo Premium",
    description: "Arquitectura NuxtJS + NestJS perfectamente sincronizada para tu negocio.",
  },
  {
    title: "Integraciones Listas",
    description:
      "Stripe, Auth (Google), Blog y Newsletter integrados desde el primer día.",
  },
  {
    title: "IA Adaptada con LangChain",
    description:
      "Agentes de IA capaces de interactuar con los datos de tu propia aplicación.",
  },
];

const isOpen = ref<boolean>(false);
</script>

<template>
  <header :class="{
    'shadow-light': colorMode === 'light',
    'shadow-dark': colorMode === 'dark',
    'container top-5 mx-auto place-items-center lg:max-w-screen-xl gap-8 mx-auto sticky border z-40 px-2 py-1 sm:p-3 rounded-sm sm:rounded-2xl flex justify-between items-center shadow-md backdrop-blur-xl': true,
  }">
    <Logo :show-text="false" />
    <!-- Mobile -->
    <div class="flex items-center lg:hidden">
      <Sheet v-model:open="isOpen">
        <SheetTrigger as-child>
          <Menu class="cursor-pointer" @click="isOpen = true" />
        </SheetTrigger>

        <SheetContent side="left" class="flex flex-col justify-between rounded-tr-2xl rounded-br-2xl bg-card">
          <div>
            <SheetHeader class="mb-4">
              <SheetTitle class="flex items-center">
                <a href="/" class="flex items-center">
                  <Logo />
                </a>
              </SheetTitle>
            </SheetHeader>

            <div class="flex flex-col gap-2">
              <Button v-for="{ href, label } in routeList" :key="label" as-child variant="ghost"
                class="justify-start text-base">
                <a :href="href" @click="isOpen = false">
                  {{ label }}
                </a>
              </Button>
            </div>
          </div>

          <SheetFooter class="flex-col sm:flex-col justify-start items-start">
            <Separator class="mb-2" />

            <Button variant="outline" as-child class="w-full mb-2">
              <NuxtLink to="/login" @click="isOpen = false">
                Login
              </NuxtLink>
            </Button>

            <ToggleTheme />
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>

    <!-- Desktop -->
    <NavigationMenu class="hidden lg:block">
      <NavigationMenuList>
        <!-- <NavigationMenuItem>
          <NavigationMenuTrigger class="bg-card text-base">
            Características
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div class="grid w-[600px] grid-cols-2 gap-5 p-4">
              <img src="https://www.radix-vue.com/logo.svg" alt="Beach" class="h-full w-full rounded-md object-cover" >
              <ul class="flex flex-col gap-2">
                <li
v-for="{ title, description } in featureList" :key="title"
                  class="rounded-md p-3 text-sm hover:bg-muted">
                  <p class="mb-1 font-semibold leading-none text-foreground">
                    {{ title }}
                  </p>
                  <p class="line-clamp-2 text-muted-foreground">
                    {{ description }}
                  </p>
                </li>
              </ul>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem> -->

        <NavigationMenuItem class="flex justify-end gap-2">
          <NavigationMenuLink as-child>
            <Button v-for="{ href, label } in routeList" :key="label" as-child variant="ghost"
              class="justify-start text-base">
              <a :href="href">
                {{ label }}
              </a>
            </Button>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>

    <div class="hidden lg:flex">
      <Button variant="outline" as-child>
        <NuxtLink to="/login">
          Login
        </NuxtLink>
      </Button>
      <ToggleTheme />
    </div>
  </header>
</template>

<style scoped>
.shadow-light {
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.085);
}

.shadow-dark {
  box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.141);
}
</style>
