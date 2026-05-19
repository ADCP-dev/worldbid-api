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
  <div style="width:1200px;height:630px;display:flex;flex-direction:column;justify-content:flex-end;padding:80px 100px;background-image:linear-gradient(135deg,#0f0c29,#302b63,#24243e);color:white;font-family:sans-serif;position:relative;overflow:hidden;box-sizing:border-box">
    <!-- Decorative top line -->
    <div style="position:absolute;top:0;left:0;width:100%;height:6px;background:linear-gradient(to right,#7c3aed,#3b82f6,#06b6d4)" />

    <!-- Decorative circle -->
    <div style="position:absolute;top:-120px;right:-80px;width:400px;height:400px;border-radius:9999px;background:rgba(124,58,237,0.08)" />

    <!-- Content -->
    <div style="position:relative;z-index:1;display:flex;flex-direction:column;max-width:1000px">
      <!-- Category pill -->
      <div v-if="category" style="display:inline-flex;margin-bottom:28px">
        <span style="background:linear-gradient(to right,#7c3aed,#3b82f6);color:white;font-size:22px;font-weight:600;padding:10px 24px;border-radius:9999px;letter-spacing:0.04em;text-transform:uppercase">
          {{ category }}
        </span>
      </div>

      <!-- Title -->
      <div style="font-size:56px;font-weight:800;line-height:1.15;margin-bottom:28px">
        {{ title || 'Blog Post' }}
      </div>

      <!-- Description -->
      <div v-if="description" style="font-size:26px;line-height:1.45;color:rgba(255,255,255,0.65);margin-bottom:48px;max-width:950px">
        {{ description }}
      </div>
    </div>

    <!-- Footer bar -->
    <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;padding-top:28px;border-top:1px solid rgba(255,255,255,0.08)">
      <span style="font-size:22px;font-weight:600;color:rgba(255,255,255,0.7)">{{ siteName || 'Foundation' }}</span>
      <span style="font-size:18px;color:rgba(255,255,255,0.3)">foundation.dev</span>
    </div>
  </div>
</template>
