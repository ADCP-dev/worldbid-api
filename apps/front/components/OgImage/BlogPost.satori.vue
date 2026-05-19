<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  siteName?: string
  category?: string
}>()
</script>

<template>
  <div style="width:1200px;height:630px;display:flex;flex-direction:column;justify-content:center;align-items:center;background-color:#1a1a2e;color:white;font-family:sans-serif;padding:80px">
    <div v-if="category" style="font-size:24px;color:#a0a0ff;margin-bottom:24px;font-weight:600;text-transform:uppercase">
      {{ category }}
    </div>
    <div style="font-size:56px;font-weight:700;text-align:center;max-width:900px;line-height:1.2;margin-bottom:32px">
      {{ title || 'Blog Post' }}
    </div>
    <div v-if="description" style="font-size:28px;color:#cccccc;text-align:center;max-width:800px;line-height:1.4;margin-bottom:48px">
      {{ description }}
    </div>
    <div style="font-size:20px;color:#888;font-weight:500">
      {{ siteName || 'Foundation' }}
    </div>
  </div>
</template>
