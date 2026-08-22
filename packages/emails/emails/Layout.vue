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
  --color-primary: #F97316;
  --color-primary-content: #0A0A0A;
  --color-base-100: #161616;
  --color-base-200: #1e1e1e;
  --color-base-300: #262626;
  --color-base-content: #F5F5F5;
}
</style>
