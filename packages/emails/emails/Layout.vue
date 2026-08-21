<script setup>
import { useConfig } from '@maizzle/framework'

const { appName, appUrl } = useConfig()
</script>

<template>
  <slot />
</template>

<style>
@import '@maizzle/tailwindcss';

@theme {
  --color-primary: #2563eb;
}
</style>