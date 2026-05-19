<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  image?: string
  siteName?: string
  category?: string
}>()
</script>

<template>
  <div style="width:1200px;height:630px;display:flex;flex-direction:column;justify-content:flex-end;background:#111827;position:relative;overflow:hidden;font-family:Inter">
    <!-- Background image -->
    <img
      v-if="image"
      :src="image"
      style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0.5"
    />
    <!-- Gradient overlay -->
    <div style="position:absolute;top:0;left:0;width:100%;height:100%;background-image:linear-gradient(to top,rgba(0,0,0,0.9),rgba(0,0,0,0.4),rgba(0,0,0,0.2))" />

    <!-- Content -->
    <div style="position:relative;z-index:10;display:flex;flex-direction:column;padding:64px;padding-bottom:80px">
      <!-- Category -->
      <div v-if="category" style="display:flex;margin-bottom:24px">
        <span style="color:rgba(255,255,255,0.8);font-size:24px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;background:rgba(255,255,255,0.1);padding:12px 20px;border-radius:8px">
          {{ category }}
        </span>
      </div>

      <!-- Title -->
      <div style="color:white;font-size:56px;font-weight:700;line-height:1.15;margin-bottom:24px;max-width:1000px">
        {{ title || 'Blog Post' }}
      </div>

      <!-- Description -->
      <div v-if="description" style="color:rgba(255,255,255,0.7);font-size:28px;line-height:1.4;max-width:900px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
        {{ description }}
      </div>

      <!-- Footer -->
      <div style="display:flex;align-items:center;margin-top:40px;padding-top:32px;border-top:1px solid rgba(255,255,255,0.1)">
        <span style="color:rgba(255,255,255,0.5);font-size:24px;font-weight:500">{{ siteName || 'Foundation' }}</span>
      </div>
    </div>
  </div>
</template>
