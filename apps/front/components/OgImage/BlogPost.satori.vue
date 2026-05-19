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
  <div class="w-full h-full flex flex-col justify-end bg-gray-900 relative overflow-hidden" style="width:1200px;height:630px">
    <!-- Background image with overlay -->
    <img
      v-if="image"
      :src="image"
      class="absolute inset-0 w-full h-full object-cover opacity-50"
    />
    <!-- Gradient overlay -->
    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />

    <!-- Content -->
    <div class="relative z-10 flex flex-col justify-end p-16 pb-20">
      <!-- Category badge -->
      <div v-if="category" class="flex items-center mb-6">
        <span class="text-white/80 text-xl font-semibold uppercase tracking-wider bg-white/10 px-5 py-2 rounded-lg">
          {{ category }}
        </span>
      </div>

      <!-- Title -->
      <h1 class="text-white font-bold text-5xl leading-tight mb-6" style="line-height:1.15">
        {{ title || 'Blog Post' }}
      </h1>

      <!-- Description -->
      <p v-if="description" class="text-white/70 text-2xl leading-relaxed max-w-3xl line-clamp-2">
        {{ description }}
      </p>

      <!-- Site name footer -->
      <div class="flex items-center mt-10 pt-8 border-t border-white/10">
        <span class="text-white/50 text-xl font-medium">{{ siteName || 'Foundation' }}</span>
      </div>
    </div>
  </div>
</template>
