<script setup lang="ts">
import { computed } from 'vue'
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const availableLocales = computed(() => {
    return locales.value.filter(i => i.code !== locale.value)
})

const currentLocaleObj = computed(() => locales.value.find(l => l.code === locale.value))
const currentFlagCode = computed(() => {
    const val = currentLocaleObj.value?.flagCode || locale.value
    return String(val)
})

function getFlagCode(loc: any) {
    return String(loc.flagCode || loc.code)
}
</script>
<template>
    <div class="dropdown dropdown-end">
        <div tabindex="0" role="button" class="btn btn-outline btn-sm border border-base-content/20 gap-2">
            <FlagIcon :code="currentFlagCode" />
            <span class="font-bold uppercase">{{ locale }}</span>
        </div>
        <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 mt-2 border border-base-content/20">
            <li v-for="loc in availableLocales" :key="loc.code">
                <button class="flex gap-3 items-center" @click.prevent.stop="navigateTo(switchLocalePath(loc.code))">
                    <FlagIcon :code="getFlagCode(loc)" />
                    <span>{{ loc.name }}</span>
                </button>
            </li>
        </ul>
    </div>
</template>
