<script setup lang="ts">

const props = defineProps({
    size: {
        type: String,
        default: 'sm'
    }
})

const logoSize = computed(() => {
    switch (props.size) {
        case 'sm':
            return 'w-10 h-10'
        case 'md':
            return 'w-14 h-14'
        case 'lg':
            return 'w-18 h-18'
    }
    return ''
})
</script>

<template>
    <a href="#" class="flex font-bold items-center gap-3">
        <img src="/logo.svg" alt="logo" :class="logoSize" />

    </a>
</template>
