<script setup lang="ts">
const props = defineProps<{
  title: string;
  url: string;
  description?: string;
}>();

const encodedTitle = computed(() => encodeURIComponent(props.title));
const encodedUrl = computed(() => encodeURIComponent(props.url));
const encodedDesc = computed(() => encodeURIComponent(props.description || props.title));

const shares = computed(() => [
  {
    label: 'Twitter',
    icon: 'X',
    url: `https://twitter.com/intent/tweet?text=${encodedTitle.value}&url=${encodedUrl.value}`,
  },
  {
    label: 'LinkedIn',
    icon: 'in',
    url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl.value}`,
  },
  {
    label: 'Facebook',
    icon: 'f',
    url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl.value}`,
  },
  {
    label: 'Email',
    icon: '@',
    url: `mailto:?subject=${encodedTitle.value}&body=${encodedUrl.value}`,
  },
]);

const copied = ref(false);

async function copyLink() {
  try {
    await navigator.clipboard.writeText(props.url);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    // fallback
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="text-sm font-medium text-base-content/60 mr-1">Compartir:</span>
    <a
      v-for="s in shares"
      :key="s.label"
      :href="s.url"
      target="_blank"
      rel="noopener noreferrer"
      :title="s.label"
      class="btn btn-xs btn-outline btn-square"
    >
      {{ s.icon }}
    </a>
    <button
      type="button"
      class="btn btn-xs btn-outline btn-square"
      title="Copiar link"
      @click="copyLink"
    >
      <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    </button>
  </div>
</template>
