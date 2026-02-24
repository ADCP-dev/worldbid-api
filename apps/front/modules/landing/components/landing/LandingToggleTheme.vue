<script setup lang="ts">
import { useColorMode } from "@vueuse/core";
import { Moon, Sun } from "lucide-vue-next";
const mode = useColorMode();
</script>

<template>
  <button class="btn btn-ghost btn-circle btn-sm" @click="mode = mode === 'dark' ? 'light' : 'dark'">
    <div v-if="mode === 'light'" class="flex items-center justify-center">
      <Moon class="size-5" />
    </div>

    <div v-else class="flex items-center justify-center">
      <Sun class="size-5" />
    </div>

    <span class="sr-only">Toggle theme</span>
  </button>
</template>
