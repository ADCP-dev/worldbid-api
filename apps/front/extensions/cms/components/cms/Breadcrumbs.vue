<script setup lang="ts">
const props = defineProps<{
  items: Array<{ name: string; url?: string }>;
}>();

const jsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: props.items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: item.url || undefined,
  })),
}));
</script>

<template>
  <nav aria-label="Breadcrumb" class="mb-6">
    <div class="breadcrumbs text-sm">
      <ul>
        <li v-for="(item, index) in items" :key="index">
          <NuxtLink
            v-if="item.url && index < items.length - 1"
            :to="item.url"
            class="text-base-content/70 hover:text-primary"
          >
            {{ item.name }}
          </NuxtLink>
          <span v-else class="text-base-content/50">{{ item.name }}</span>
        </li>
      </ul>
    </div>
    <component is="script" type="application/ld+json" v-text="JSON.stringify(jsonLd, null, 2)" />
  </nav>
</template>
