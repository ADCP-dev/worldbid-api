<script setup lang="ts">
const props = defineProps<{
  id: string;
  type: "page" | "post";
}>();

const config = useRuntimeConfig();

function openPreview() {
  const url = `${config.public.apiUrl}/api/v1/cms/${props.type}s/${props.id}/preview`;
  window.open(url, "_blank");
}
</script>

<template>
  <button type="button" class="btn btn-outline btn-sm" @click="openPreview">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4 mr-1"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
    Preview
  </button>
</template>
