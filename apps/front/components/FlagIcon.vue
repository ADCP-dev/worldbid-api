<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    code: string;
    squared?: boolean;
}>();

const iconClass = computed(() => {
    return `fi fi-${props.code.toLowerCase()}${props.squared ? ' fis' : ''}`;
});
</script>

<template>
    <span :class="iconClass"></span>
</template>
