<script setup lang="ts">

</script>

<template>
  <div>
    <Transition name="fade" mode="out-in">
      <slot />
    </Transition>
  </div>
</template>
<style>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>