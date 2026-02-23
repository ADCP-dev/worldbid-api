<script setup lang="ts">
import { computed } from 'vue'
const { locale, locales, setLocale } = useI18n()

const availableLocales = computed(() => {
    return locales.value.filter(i => i.code !== locale.value)
})

const currentLocaleObj = computed(() => locales.value.find(l => l.code === locale.value))
</script>
<template>
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button variant="outline" class="mr-4 cursor-pointer flex gap-2 items-center">
                <FlagIcon :code="currentLocaleObj?.flagCode || locale" />
                <span class="uppercase font-semibold">{{ locale }}</span>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuItem v-for="loc in availableLocales" :key="loc.code"
                @click.prevent.stop="setLocale(loc.code)" class="flex gap-2 items-center cursor-pointer">
                <FlagIcon :code="loc.flagCode || loc.code" />
                <span>{{ loc.name }}</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
</template>
