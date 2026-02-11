<script setup>
import * as icons from "lucide-vue-next";

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    default: 24
  },
  strokeWidth: {
    type: Number,
    default: 2
  },
  defaultClass: {
    type: String,
    default: ''
  }
})

// Get dynamic icon component
const icon = computed(() => icons[props.name]);
</script>

<template>
  <component
    :is="icon"
    :size="size"
    :stroke-width="strokeWidth"
    :default-class="defaultClass"
    class="icon"
  />
</template>