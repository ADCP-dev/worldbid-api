<script setup lang="ts">
import { useColorMode } from "@vueuse/core";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-vue-next";
const mode = useColorMode();
</script>

<template>
  <Button size="icon" variant="ghost" @click="mode = mode === 'dark' ? 'light' : 'dark'">
    <div v-if="mode === 'light'" class="flex">
      <Moon class="size-5" />
      <span class="block hidden"> Dark </span>
    </div>

    <div v-else class="flex">
      <Sun class="size-5" />
      <span class="block hidden">Light</span>
    </div>

    <span class="sr-only">Toggle theme</span>
  </Button>
</template>
