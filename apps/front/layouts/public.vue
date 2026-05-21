<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen bg-base-100">
    <LandingNavbar />

    <main class="container mx-auto">
      <slot />
    </main>

    <LandingFooter />
  </div>
</template>
