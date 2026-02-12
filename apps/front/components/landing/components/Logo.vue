<script setup lang="ts">

const props = defineProps({
    showText: {
        type: Boolean,
        default: true
    },
    sizeLogo: {
        type: String,
        default: 'sm'
    },
    sizeText: {
        type: String,
        default: 'md'
    }
})

const logoSize = computed(() => {
    switch (props.sizeLogo) {
        case 'sm':
            return 'w-10 h-10'
        case 'md':
            return 'w-14 h-14'
        case 'lg':
            return 'w-18 h-18'
    }
    return ''
})

const textSize = computed(() => {
    switch (props.sizeText) {
        case 'sm':
            return 'text-md'
        case 'md':
            return 'text-xl'
        case 'lg':
            return 'text-3xl'
    }
    return ''
})
</script>
<template>
    <a href="#" class="flex font-bold items-center gap-3">
        <img src="/logo.svg" alt="logo" :class="logoSize" />

        <h3 v-if="showText" :class="textSize">{{ $config.public.appName }}</h3>
    </a>
</template>