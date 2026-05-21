<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen bg-base-100">
    <LandingNavbar />

    <main class="py-12">
      <slot />
    </main>

    <LandingFooter />
  </div>
</template>
