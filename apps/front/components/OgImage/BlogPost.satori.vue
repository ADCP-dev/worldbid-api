<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  image?: string
  siteName?: string
  category?: string
  domain?: string
}>()
</script>

<template>
  <div style="width:1200px;height:630px;display:flex;position:relative;overflow:hidden;font-family:sans-serif;box-sizing:border-box">
    <!-- Background — solid gradient -->
    <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,#0f0c29,#1a1744,#0f0c29)" />

    <!-- Accent line top -->
    <div style="position:absolute;top:0;left:0;width:100%;height:4px;background:linear-gradient(to right,#7c3aed,#a78bfa,#3b82f6)" />

    <!-- Content -->
    <div style="position:relative;z-index:1;display:flex;flex-direction:column;justify-content:flex-end;padding:70px 90px 60px 90px;width:100%;box-sizing:border-box">
      <!-- Badges row -->
      <div style="display:flex;gap:16px;margin-bottom:28px">
        <span style="background:rgba(124,58,237,0.25);color:#c4b5fd;font-size:20px;font-weight:600;padding:8px 20px;border-radius:9999px;border:1px solid rgba(124,58,237,0.4);text-transform:uppercase;letter-spacing:0.06em">
          Blog
        </span>
        <span v-if="category" style="background:rgba(59,130,246,0.2);color:#93c5fd;font-size:20px;font-weight:600;padding:8px 20px;border-radius:9999px;border:1px solid rgba(59,130,246,0.35);text-transform:uppercase;letter-spacing:0.06em">
          {{ category }}
        </span>
      </div>

      <!-- Title -->
      <div style="font-size:52px;font-weight:800;line-height:1.1;color:white;margin-bottom:24px;max-width:1050px;letter-spacing:-0.01em">
        {{ title || '' }}
      </div>

      <!-- Description -->
      <div v-if="description" style="font-size:24px;line-height:1.5;color:rgba(255,255,255,0.6);margin-bottom:40px;max-width:950px">
        {{ description }}
      </div>

      <!-- Footer -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08)">
        <span style="font-size:22px;font-weight:600;color:rgba(255,255,255,0.75);letter-spacing:0.02em">{{ siteName || '' }}</span>
        <span style="font-size:16px;color:rgba(255,255,255,0.25)">{{ domain || '' }}</span>
      </div>
    </div>
  </div>
</template>
